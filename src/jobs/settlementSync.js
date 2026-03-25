const { PaystackSubaccount, Settlement, Caregiver } = require('../models');
const paystackService = require('../services/paystackService');
const logger = require('../utils/logger');

const syncSettlementsForSubaccount = async (caregiverId, subaccountCode) => {
  try {
    const settlements = await paystackService.fetchSettlements(subaccountCode);

    let synced = 0;
    for (const s of settlements) {
      await Settlement.upsert({
        caregiverId,
        subaccountCode,
        paystackSettlementId: s.id,
        amount: s.settlement_amount / 100, // kobo to KES
        totalFees: s.total_fees ? s.total_fees / 100 : null,
        status: s.status || 'processed',
        settledAt: s.settled_at || s.createdAt,
        integration: s.integration,
        metadata: s
      }, { conflictFields: ['paystack_settlement_id'] });
      synced++;
    }

    logger.info(`Synced ${synced} settlements for subaccount ${subaccountCode}`);
    return synced;
  } catch (error) {
    logger.error(`Settlement sync failed for ${subaccountCode}:`, error.message);
    return 0;
  }
};

const syncAllSettlements = async () => {
  try {
    logger.info('Starting settlement sync...');
    const subaccounts = await PaystackSubaccount.findAll({ where: { isActive: true } });

    let total = 0;
    for (const sub of subaccounts) {
      const count = await syncSettlementsForSubaccount(sub.caregiverId, sub.subaccountCode);
      total += count;
    }

    logger.info(`Settlement sync complete. Total synced: ${total}`);
    return total;
  } catch (error) {
    logger.error('Settlement sync job failed:', error);
    throw error;
  }
};

// Start cron — runs daily at 2am
const startSettlementSync = () => {
  const CronJob = require('cron').CronJob;
  const job = new CronJob('0 2 * * *', async () => {
    logger.info('Running scheduled settlement sync...');
    await syncAllSettlements();
  });
  job.start();
  logger.info('Settlement sync cron started (daily at 2am)');
};

module.exports = { syncAllSettlements, syncSettlementsForSubaccount, startSettlementSync };
