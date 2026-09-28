const {
  sequelize,
  LedgerAccount,
  LedgerTransaction,
  LedgerEntry,
  CaregiverEarnings,
  WithdrawalRequest,
} = require("../models");

const money = (value) => Math.round(Number(value) * 100) / 100;
const systemTypes = ["paychangu_clearing", "withdrawal_fee_revenue"];
const definition = (caregiverId, type) => ({
  accountKey: systemTypes.includes(type)
    ? `system:${type}:MWK`
    : `caregiver:${caregiverId}:${type}:MWK`,
  caregiverId: systemTypes.includes(type) ? null : caregiverId,
  accountType: type,
  currency: "MWK",
});
const lockAccount = async (caregiverId, type, transaction) => {
  const values = definition(caregiverId, type);
  await LedgerAccount.findOrCreate({
    where: { accountKey: values.accountKey },
    defaults: { ...values, currentBalance: 0 },
    transaction,
  });
  return LedgerAccount.findOne({
    where: { accountKey: values.accountKey },
    transaction,
    lock: transaction.LOCK.UPDATE,
  });
};
const syncProjection = async (caregiverId, transaction) => {
  const accounts = await LedgerAccount.findAll({
    where: {
      caregiverId,
      accountType: [
        "caregiver_locked",
        "caregiver_available",
        "caregiver_reserved",
      ],
    },
    transaction,
  });
  const values = Object.fromEntries(
    accounts.map((row) => [row.accountType, money(row.currentBalance)]),
  );
  const paid = money(
    (await WithdrawalRequest.sum("requestedAmount", {
      where: { caregiverId, status: "completed" },
      transaction,
    })) || 0,
  );
  const locked = values.caregiver_locked || 0;
  const available = values.caregiver_available || 0;
  const reserved = values.caregiver_reserved || 0;
  const [row] = await CaregiverEarnings.findOrCreate({
    where: { caregiverId },
    defaults: { caregiverId },
    transaction,
  });
  await row.update(
    {
      totalCaregiverEarnings: money(locked + available + reserved + paid),
      walletBalance: available,
      lockedBalance: locked,
      reservedBalance: reserved,
      totalPaid: paid,
    },
    { transaction },
  );
};
const post = async (data, outerTransaction = null) => {
  const execute = async (transaction) => {
    const existing = await LedgerTransaction.findOne({
      where: { idempotencyKey: data.idempotencyKey },
      transaction,
    });
    if (existing) return { transaction: existing, created: false };
    const debits = money(
      data.movements
        .filter((x) => x.direction === "debit")
        .reduce((s, x) => s + money(x.amount), 0),
    );
    const credits = money(
      data.movements
        .filter((x) => x.direction === "credit")
        .reduce((s, x) => s + money(x.amount), 0),
    );
    if (debits <= 0 || debits !== credits)
      throw new Error("Ledger transaction is not balanced");
    const ledgerTransaction = await LedgerTransaction.create(
      {
        eventType: data.eventType,
        referenceType: data.referenceType,
        referenceId: String(data.referenceId),
        idempotencyKey: data.idempotencyKey,
        currency: "MWK",
        description: data.description,
        metadata: data.metadata,
      },
      { transaction },
    );
    const movements = [...data.movements].sort((a, b) =>
      definition(data.caregiverId, a.accountType).accountKey.localeCompare(
        definition(data.caregiverId, b.accountType).accountKey,
      ),
    );
    for (const movement of movements) {
      const account = await lockAccount(
        data.caregiverId,
        movement.accountType,
        transaction,
      );
      const before = money(account.currentBalance);
      const after = money(
        before +
          (movement.direction === "credit"
            ? money(movement.amount)
            : -money(movement.amount)),
      );
      if (after < 0 && !systemTypes.includes(movement.accountType)) {
        const error = new Error(`Insufficient ${movement.accountType} balance`);
        error.code = "INSUFFICIENT_LEDGER_BALANCE";
        error.availableBalance = before;
        throw error;
      }
      await account.update({ currentBalance: after }, { transaction });
      await LedgerEntry.create(
        {
          ledgerTransactionId: ledgerTransaction.id,
          accountId: account.id,
          direction: movement.direction,
          amount: money(movement.amount),
          balanceBefore: before,
          balanceAfter: after,
          currency: "MWK",
        },
        { transaction },
      );
    }
    await syncProjection(data.caregiverId, transaction);
    return { transaction: ledgerTransaction, created: true };
  };
  return outerTransaction
    ? execute(outerTransaction)
    : sequelize.transaction(execute);
};
const recordEarning = (x, t) =>
  post(
    {
      eventType: "earning_recorded",
      referenceType: "payment",
      referenceId: x.paymentId,
      idempotencyKey: `earning:${x.paymentId}`,
      caregiverId: x.caregiverId,
      movements: [
        {
          accountType: "paychangu_clearing",
          direction: "debit",
          amount: x.amount,
        },
        {
          accountType: x.available ? "caregiver_available" : "caregiver_locked",
          direction: "credit",
          amount: x.amount,
        },
      ],
      description: x.available
        ? "Caregiver earning available"
        : "Caregiver earning locked pending care report",
      metadata: { paychanguReference: x.paychanguReference },
    },
    t,
  );
const unlockEarning = (x, t) =>
  post(
    {
      eventType: "care_report_unlock",
      referenceType: "appointment",
      referenceId: x.appointmentId,
      idempotencyKey: `report-unlock:${x.appointmentId}`,
      caregiverId: x.caregiverId,
      movements: [
        {
          accountType: "caregiver_locked",
          direction: "debit",
          amount: x.amount,
        },
        {
          accountType: "caregiver_available",
          direction: "credit",
          amount: x.amount,
        },
      ],
      description: "Care report submitted; earning unlocked",
      metadata: { paymentId: x.paymentId },
    },
    t,
  );
const reserveWithdrawal = (x, t) =>
  post(
    {
      eventType: "withdrawal_reserved",
      referenceType: "withdrawal",
      referenceId: x.withdrawalId,
      idempotencyKey: `withdrawal-reserve:${x.withdrawalId}`,
      caregiverId: x.caregiverId,
      movements: [
        {
          accountType: "caregiver_available",
          direction: "debit",
          amount: x.amount,
        },
        {
          accountType: "caregiver_reserved",
          direction: "credit",
          amount: x.amount,
        },
      ],
      description: "Funds reserved for PayChangu payout",
      metadata: { payoutReference: x.payoutReference },
    },
    t,
  );
const completeWithdrawal = (x, t) =>
  post(
    {
      eventType: "withdrawal_completed",
      referenceType: "withdrawal",
      referenceId: x.withdrawalId,
      idempotencyKey: `withdrawal-complete:${x.withdrawalId}`,
      caregiverId: x.caregiverId,
      movements: [
        {
          accountType: "caregiver_reserved",
          direction: "debit",
          amount: x.amount,
        },
        {
          accountType: "paychangu_clearing",
          direction: "credit",
          amount: x.netPayout,
        },
        ...(Number(x.fee) > 0
          ? [
              {
                accountType: "withdrawal_fee_revenue",
                direction: "credit",
                amount: x.fee,
              },
            ]
          : []),
      ],
      description: "PayChangu payout completed",
      metadata: { payoutReference: x.payoutReference },
    },
    t,
  );
const reverseWithdrawal = (x, t) =>
  post(
    {
      eventType: "withdrawal_reversed",
      referenceType: "withdrawal",
      referenceId: x.withdrawalId,
      idempotencyKey: `withdrawal-reverse:${x.withdrawalId}`,
      caregiverId: x.caregiverId,
      movements: [
        {
          accountType: "caregiver_reserved",
          direction: "debit",
          amount: x.amount,
        },
        {
          accountType: "caregiver_available",
          direction: "credit",
          amount: x.amount,
        },
      ],
      description: "Failed payout returned to available balance",
      metadata: { payoutReference: x.payoutReference },
    },
    t,
  );

module.exports = {
  recordEarning,
  unlockEarning,
  reserveWithdrawal,
  completeWithdrawal,
  reverseWithdrawal,
  syncProjection,
};
