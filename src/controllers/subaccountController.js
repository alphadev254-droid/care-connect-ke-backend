const { PaystackSubaccount, Caregiver, CaregiverEarnings, Settlement } = require('../models');
const paystackService = require('../services/paystackService');
const { syncSettlementsForSubaccount } = require('../jobs/settlementSync');
const logger = require('../utils/logger');

/**
 * GET /api/settlements/banks
 */
const getBanks = async (req, res, next) => {
  try {
    const banks = await paystackService.getBanks();
    res.json({ banks });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/settlements/subaccount
 * Caregiver fetches their own subaccount info
 */
const getMySubaccount = async (req, res, next) => {
  try {
    const caregiver = await Caregiver.findOne({ where: { userId: req.user.id } });
    if (!caregiver) return res.status(404).json({ error: 'Caregiver profile not found' });

    const subaccount = await PaystackSubaccount.findOne({ where: { caregiverId: caregiver.id }, attributes: { exclude: ['paystackResponse','percentageCharge'] } });

    if (subaccount?.subaccountCode) {
  subaccount.subaccountCode =
    subaccount.subaccountCode.slice(0, -7) + '*******';
     }

    res.json({ subaccount: subaccount || null });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/settlements/subaccount
 * Caregiver submits bank details — creates or updates Paystack subaccount
 */
/**
 * POST /api/settlements/subaccount
 * Creates or updates a Paystack subaccount for the caregiver.
 * - First time: calls paystackService.createSubaccount
 * - Subsequent times: calls paystackService.updateSubaccount with the stored subaccountCode
 */
const saveSubaccount = async (req, res, next) => {
  try {
    const { businessName, settlementBank, accountNumber, accountName } = req.body;

    if (!businessName || !settlementBank || !accountNumber) {
      return res.status(400).json({ error: 'businessName, settlementBank and accountNumber are required' });
    }

    const caregiver = await Caregiver.findOne({ where: { userId: req.user.id } });
    if (!caregiver) return res.status(404).json({ error: 'Caregiver profile not found' });

    const existing = await PaystackSubaccount.findOne({ where: { caregiverId: caregiver.id } });

    let paystackData;

    if (existing) {
      // UPDATE — use the stored subaccountCode, no new subaccount created on Paystack
      paystackData = await paystackService.updateSubaccount({
        subaccountCode: existing.subaccountCode,
        businessName,
        settlementBank,
        accountNumber,
        percentageCharge: existing.percentageCharge ?? 78
      });

      await existing.update({
        businessName,
        settlementBank,
        accountNumber,
        accountName: accountName || null,
        // subaccountCode stays the same — Paystack doesn't change it on update
        paystackResponse: paystackData,
        isActive: true
      });

      return res.json({ message: 'Subaccount updated successfully', subaccount: existing });
    }

    // ✅ CREATE — first time setup
    paystackData = await paystackService.createSubaccount({
      businessName,
      settlementBank,
      accountNumber,
      percentageCharge: 78
    });

    const subaccount = await PaystackSubaccount.create({
      caregiverId: caregiver.id,
      businessName,
      settlementBank,
      accountNumber,
      accountName: accountName || null,
      subaccountCode: paystackData.subaccount_code,
      percentageCharge: 78,
      paystackResponse: paystackData,
      isActive: true
    });

    res.status(201).json({ message: 'Subaccount created successfully', subaccount });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/settlements/balance
 */
const getBalance = async (req, res, next) => {
  try {
    const caregiver = await Caregiver.findOne({ where: { userId: req.user.id } });
    if (!caregiver) return res.status(404).json({ error: 'Caregiver profile not found' });

    const [earnings] = await CaregiverEarnings.findOrCreate({
      where: { caregiverId: caregiver.id },
      defaults: { caregiverId: caregiver.id, totalCaregiverEarnings: 0, walletBalance: 0 }
    });

    res.json({
      caregiverId: caregiver.id,
      totalEarnings: parseFloat(earnings.totalCaregiverEarnings).toFixed(2),
      availableBalance: parseFloat(earnings.walletBalance).toFixed(2),
      currency: 'KES'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/settlements/settlements
 */
const getSettlements = async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const caregiver = await Caregiver.findOne({ where: { userId: req.user.id } });
    if (!caregiver) return res.status(404).json({ error: 'Caregiver profile not found' });

    const { count, rows: settlements } = await Settlement.findAndCountAll({
      where: { caregiverId: caregiver.id },
      order: [['settled_at', 'DESC']],
      limit: parseInt(limit),
      offset
    });

    res.json({
      settlements,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(count / parseInt(limit)),
        totalRecords: count,
        pageSize: parseInt(limit)
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/settlements/sync
 * Manually trigger settlement sync for the authenticated caregiver
 */
const syncMySettlements = async (req, res, next) => {
  try {
    const caregiver = await Caregiver.findOne({ where: { userId: req.user.id } });
    if (!caregiver) return res.status(404).json({ error: 'Caregiver profile not found' });

    const subaccount = await PaystackSubaccount.findOne({ where: { caregiverId: caregiver.id, isActive: true } });
    if (!subaccount) return res.status(404).json({ error: 'No active subaccount found. Please set up your bank details first.' });

    const synced = await syncSettlementsForSubaccount(caregiver.id, subaccount.subaccountCode);
    res.json({ message: `Synced ${synced} settlements`, synced });
  } catch (error) {
    next(error);
  }
};

module.exports = { getBanks, getMySubaccount, saveSubaccount, getBalance, getSettlements, syncMySettlements };
