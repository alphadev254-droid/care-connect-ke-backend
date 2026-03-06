const cron = require('node-cron');
const EmailScheduler = require('../services/emailScheduler');

// Process email queue every 10 seconds for faster delivery
const startEmailProcessor = () => {
  cron.schedule('*/10 * * * * *', async () => {
    console.log('Processing email queue...');
    await EmailScheduler.processEmailQueue();
  });
  
  console.log('Email processor started - running every 10 seconds');
};

module.exports = { startEmailProcessor };