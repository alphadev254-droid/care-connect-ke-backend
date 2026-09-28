const express = require("express");
const crypto = require("crypto");
const { Op } = require("sequelize");
const { authenticateToken } = require("../middleware/auth.middleware");
const {
  CaregiverEarnings,
  WithdrawalRequest,
  WithdrawalToken,
  Caregiver,
  User,
  sequelize,
} = require("../models");
const paymentService = require("../services/paymentService");
const ledger = require("../services/ledgerService");
const logger = require("../utils/logger");
const {
  sendWithdrawalTokenEmail,
  sendWithdrawalSuccessEmail,
} = require("../services/emailService");
const router = express.Router();

const secret = process.env.WITHDRAWAL_TOKEN_SECRET || process.env.JWT_SECRET;
const digest = (value) => {
  if (!secret)
    throw new Error("WITHDRAWAL_TOKEN_SECRET or JWT_SECRET must be configured");
  return crypto
    .createHmac("sha256", secret)
    .update(String(value))
    .digest("hex");
};
const matches = (stored, plain) => {
  const a = Buffer.from(String(stored), "hex");
  const b = Buffer.from(digest(plain), "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};
const caregiverFor = (userId, withUser = false) =>
  Caregiver.findOne({
    where: { userId },
    include: withUser
      ? [{ model: User, attributes: ["firstName", "lastName", "email"] }]
      : undefined,
  });
const payoutStatus = (value) =>
  ["success", "successful", "completed"].includes(value)
    ? "completed"
    : ["failed", "cancelled", "rejected"].includes(value)
      ? "failed"
      : "processing";
const calculatedFee = (amount, type) =>
  type === "bank"
    ? Math.round(
        (amount * (parseFloat(process.env.WITHDRAWAL_BANK_FEE_RATE) || 0.01) +
          (parseFloat(process.env.WITHDRAWAL_BANK_FIXED_FEE) || 700)) *
          100,
      ) / 100
    : Math.round(
        amount *
          (parseFloat(process.env.WITHDRAWAL_MOBILE_MONEY_FEE_RATE) || 0.03) *
          100,
      ) / 100;
const signatureOf = (req) =>
  req.headers["x-paychangu-signature"] ||
  req.headers["x-webhook-signature"] ||
  req.headers.signature ||
  req.headers["x-signature"] ||
  req.headers["paychangu-signature"];

router.post("/webhook", async (req, res, next) => {
  try {
    const signature = signatureOf(req);
    if (
      !signature ||
      !paymentService.verifyWebhookSignature(req.body, signature)
    )
      return res.status(401).json({ error: "Invalid webhook signature" });
    const reference = req.body?.reference || req.body?.charge_id;
    if (!reference)
      return res
        .status(400)
        .json({ error: "reference or charge_id is required" });
    const withdrawal = await WithdrawalRequest.findOne({
      where: { payoutReference: reference },
    });
    if (!withdrawal)
      return res.status(404).json({ error: "Withdrawal request not found" });
    const nextStatus = payoutStatus(req.body.status);
    await sequelize.transaction(async (transaction) => {
      const row = await WithdrawalRequest.findByPk(withdrawal.id, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (
        ["completed", "failed"].includes(row.status) &&
        row.status !== nextStatus
      ) {
        logger.error("Conflicting terminal payout status", {
          reference,
          current: row.status,
          received: nextStatus,
        });
        return;
      }
      await row.update(
        {
          status: nextStatus,
          processedAt: nextStatus === "processing" ? null : new Date(),
          paychanguResponse: {
            chargeId: req.body.charge_id,
            reference,
            status: req.body.status,
            webhookReceivedAt: new Date().toISOString(),
          },
        },
        { transaction },
      );
      const args = {
        caregiverId: row.caregiverId,
        amount: row.requestedAmount,
        netPayout: row.netPayout,
        fee: row.withdrawalFee,
        withdrawalId: row.id,
        payoutReference: row.payoutReference,
      };
      if (nextStatus === "completed")
        await ledger.completeWithdrawal(args, transaction);
      if (nextStatus === "failed")
        await ledger.reverseWithdrawal(args, transaction);
    });
    return res.json({ message: "Webhook processed successfully" });
  } catch (error) {
    return next(error);
  }
});

router.use(authenticateToken);
router.post("/request-token", async (req, res, next) => {
  try {
    const caregiver = await caregiverFor(req.user.id, true);
    if (!caregiver)
      return res.status(404).json({ error: "Caregiver profile not found" });
    const recent = await WithdrawalToken.count({
      where: {
        caregiverId: caregiver.id,
        created_at: { [Op.gte]: new Date(Date.now() - 300000) },
      },
    });
    if (recent >= 3)
      return res
        .status(429)
        .json({ error: "Too many token requests. Please wait 5 minutes." });
    const plain = crypto.randomInt(100000, 1000000).toString();
    await sequelize.transaction(async (transaction) => {
      await WithdrawalToken.update(
        { used: true },
        { where: { caregiverId: caregiver.id, used: false }, transaction },
      );
      await WithdrawalToken.create(
        {
          caregiverId: caregiver.id,
          token: digest(plain),
          expiresAt: new Date(Date.now() + 180000),
        },
        { transaction },
      );
    });
    await sendWithdrawalTokenEmail(
      caregiver.User.email,
      `${caregiver.User.firstName} ${caregiver.User.lastName}`,
      plain,
    );
    return res.json({ message: "Withdrawal token sent to your email" });
  } catch (error) {
    return next(error);
  }
});

const validateToken = async (caregiverId, plain, consume, transaction) => {
  const token = await WithdrawalToken.findOne({
    where: { caregiverId, used: false, expiresAt: { [Op.gt]: new Date() } },
    order: [["created_at", "DESC"]],
    transaction,
    lock: transaction.LOCK.UPDATE,
  });
  if (!token || token.attemptCount >= 5) return false;
  if (!matches(token.token, plain)) {
    const attempts = token.attemptCount + 1;
    await token.update(
      { attemptCount: attempts, used: attempts >= 5 },
      { transaction },
    );
    return false;
  }
  if (consume) await token.update({ used: true }, { transaction });
  return true;
};
router.post("/verify-token", async (req, res, next) => {
  try {
    const amount = Number(req.body.amount);
    if (
      !/^\d{6}$/.test(String(req.body.token || "")) ||
      !Number.isFinite(amount) ||
      amount <= 0
    )
      return res.status(400).json({ error: "Invalid token or amount" });
    const caregiver = await caregiverFor(req.user.id);
    if (!caregiver)
      return res.status(404).json({ error: "Caregiver profile not found" });
    const valid = await sequelize.transaction((t) =>
      validateToken(caregiver.id, req.body.token, false, t),
    );
    if (!valid)
      return res.status(400).json({ error: "Invalid or expired token" });
    const earnings = await CaregiverEarnings.findOne({
      where: { caregiverId: caregiver.id },
    });
    if (!earnings || Number(earnings.walletBalance) < amount)
      return res
        .status(400)
        .json({
          error: "Insufficient balance",
          availableBalance: Number(earnings?.walletBalance || 0).toFixed(2),
        });
    const estimate = calculatedFee(
      amount,
      req.body.recipientType || "mobile_money",
    );
    const net = Math.round(amount - estimate);
    const fee = Math.round((amount - net) * 100) / 100;
    return res.json({
      valid: true,
      requestedAmount: amount.toFixed(2),
      withdrawalFee: fee.toFixed(2),
      netPayout: net.toFixed(2),
      availableBalance: Number(earnings.walletBalance).toFixed(2),
      currency: "MWK",
    });
  } catch (error) {
    return next(error);
  }
});
router.get("/balance", async (req, res, next) => {
  try {
    const caregiver = await caregiverFor(req.user.id);
    if (!caregiver)
      return res.status(404).json({ error: "Caregiver profile not found" });
    const [row] = await CaregiverEarnings.findOrCreate({
      where: { caregiverId: caregiver.id },
      defaults: { caregiverId: caregiver.id },
    });
    return res.json({
      totalEarnings: Number(row.totalCaregiverEarnings).toFixed(2),
      availableBalance: Number(row.walletBalance).toFixed(2),
      lockedBalance: Number(row.lockedBalance).toFixed(2),
      reservedBalance: Number(row.reservedBalance).toFixed(2),
      totalPaid: Number(row.totalPaid).toFixed(2),
      currency: "MWK",
    });
  } catch (error) {
    return next(error);
  }
});
router.get("/history", async (req, res, next) => {
  try {
    const caregiver = await caregiverFor(req.user.id);
    if (!caregiver)
      return res.status(404).json({ error: "Caregiver profile not found" });
    const page = Math.max(Number(req.query.page) || 1, 1),
      limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
    const result = await WithdrawalRequest.findAndCountAll({
      where: { caregiverId: caregiver.id },
      order: [["requestedAt", "DESC"]],
      limit,
      offset: (page - 1) * limit,
    });
    return res.json({
      withdrawals: result.rows,
      pagination: {
        currentPage: page,
        pageSize: limit,
        totalRecords: result.count,
        totalPages: Math.ceil(result.count / limit),
      },
    });
  } catch (error) {
    return next(error);
  }
});

router.post("/request", async (req, res, next) => {
  try {
    const amount = Number(req.body.amount),
      recipientType = req.body.recipientType || "mobile_money",
      recipientNumber = req.body.recipientNumber;
    if (!Number.isFinite(amount) || amount <= 0 || amount > 1000000)
      return res
        .status(400)
        .json({ error: "Invalid withdrawal amount (1-1,000,000 MWK)" });
    if (
      !["mobile_money", "bank"].includes(recipientType) ||
      !recipientNumber ||
      !/^[-+0-9\s]{8,30}$/.test(recipientNumber) ||
      !/^\d{6}$/.test(String(req.body.token || ""))
    )
      return res.status(400).json({ error: "Invalid withdrawal details" });
    const caregiver = await caregiverFor(req.user.id, true);
    if (!caregiver)
      return res.status(404).json({ error: "Caregiver profile not found" });
    const estimate = calculatedFee(amount, recipientType),
      netPayout = Math.round(amount - estimate),
      fee = Math.round((amount - netPayout) * 100) / 100;
    if (netPayout <= 0)
      return res
        .status(400)
        .json({ error: "Withdrawal amount too small after fees" });
    const reference = `WD${Date.now()}${caregiver.id}${crypto.randomInt(1000, 10000)}`;
    const withdrawal = await sequelize.transaction(async (transaction) => {
      if (
        !(await validateToken(caregiver.id, req.body.token, true, transaction))
      )
        return null;
      const row = await WithdrawalRequest.create(
        {
          caregiverId: caregiver.id,
          requestedAmount: amount,
          withdrawalFee: fee,
          netPayout,
          recipientType,
          recipientNumber,
          status: "pending",
          payoutReference: reference,
        },
        { transaction },
      );
      await ledger.reserveWithdrawal(
        {
          caregiverId: caregiver.id,
          amount,
          withdrawalId: row.id,
          payoutReference: reference,
        },
        transaction,
      );
      return row;
    });
    if (!withdrawal)
      return res
        .status(400)
        .json({ error: "Invalid or expired withdrawal token" });
    let result;
    try {
      const operator =
        recipientNumber.includes("088") || recipientNumber.includes("077")
          ? "tnm"
          : "airtel";
      result = await paymentService.processWithdrawal({
        amount: netPayout,
        recipientType,
        recipientNumber,
        reference,
        operator,
        bankCode: req.body.bankCode,
        accountName: req.body.accountName,
      });
    } catch (error) {
      if (error.response && error.response.status < 500) {
        await sequelize.transaction(async (t) => {
          await ledger.reverseWithdrawal(
            {
              caregiverId: caregiver.id,
              amount,
              withdrawalId: withdrawal.id,
              payoutReference: reference,
            },
            t,
          );
          await withdrawal.update(
            {
              status: "failed",
              processedAt: new Date(),
              failureReason: error.message,
            },
            { transaction: t },
          );
        });
        return res
          .status(400)
          .json({ error: "Withdrawal rejected by PayChangu" });
      }
      await withdrawal.update({
        status: "processing",
        failureReason: "Provider response uncertain; awaiting reconciliation",
      });
      return res
        .status(202)
        .json({
          message: "Withdrawal is awaiting confirmation",
          status: "processing",
          paymentReference: reference,
          currency: "MWK",
        });
    }
    const providerStatus =
        result.data?.transaction?.status ||
        result.data?.status ||
        result.status,
      finalStatus = payoutStatus(providerStatus);
    await sequelize.transaction(async (t) => {
      await withdrawal.update(
        {
          status: finalStatus,
          processedAt: finalStatus === "processing" ? null : new Date(),
          paychanguResponse: {
            chargeId: result.data?.charge_id,
            refId: result.data?.ref_id,
            transId: result.data?.trans_id,
            status: providerStatus,
          },
        },
        { transaction: t },
      );
      const args = {
        caregiverId: caregiver.id,
        amount,
        netPayout,
        fee,
        withdrawalId: withdrawal.id,
        payoutReference: reference,
      };
      if (finalStatus === "completed") await ledger.completeWithdrawal(args, t);
      if (finalStatus === "failed") await ledger.reverseWithdrawal(args, t);
    });
    if (finalStatus === "completed")
      await sendWithdrawalSuccessEmail(caregiver.User.email, {
        caregiverName: `${caregiver.User.firstName} ${caregiver.User.lastName}`,
        requestedAmount: amount.toFixed(2),
        withdrawalFee: fee.toFixed(2),
        netPayout: netPayout.toFixed(2),
        currency: "MWK",
        paymentReference: reference,
        recipientType,
        recipientNumber,
      });
    return res
      .status(201)
      .json({
        message:
          finalStatus === "completed"
            ? "Withdrawal processed successfully"
            : finalStatus === "failed"
              ? "Withdrawal failed"
              : "Withdrawal is being processed",
        requestedAmount: amount.toFixed(2),
        withdrawalFee: fee.toFixed(2),
        netPayout: netPayout.toFixed(2),
        currency: "MWK",
        paymentReference: reference,
        recipientNumber,
        status: finalStatus,
      });
  } catch (error) {
    if (error.code === "INSUFFICIENT_LEDGER_BALANCE")
      return res
        .status(400)
        .json({
          error: "Insufficient balance",
          availableBalance: Number(error.availableBalance || 0).toFixed(2),
        });
    return next(error);
  }
});
const statusHandler = async (req, res, next) => {
  try {
    const caregiver = await caregiverFor(req.user.id);
    if (!caregiver)
      return res.status(404).json({ error: "Caregiver profile not found" });
    const row = await WithdrawalRequest.findOne({
      where: {
        caregiverId: caregiver.id,
        payoutReference: req.params.reference,
      },
    });
    if (!row)
      return res.status(404).json({ error: "Withdrawal request not found" });
    return res.json({
      reference: row.payoutReference,
      status: row.status,
      requestedAmount: Number(row.requestedAmount).toFixed(2),
      netPayout: Number(row.netPayout).toFixed(2),
      requestedAt: row.requestedAt,
      processedAt: row.processedAt,
      currency: "MWK",
    });
  } catch (error) {
    return next(error);
  }
};
router.get("/status/:reference", statusHandler);
router.get("/verify/:reference", statusHandler);
module.exports = router;
