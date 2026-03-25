require('dotenv').config();

const platformCommissionRate = parseFloat(process.env.PLATFORM_COMMISSION_RATE) || 20;
const convenienceFeeCard   = parseFloat(process.env.PAYMENT_CONVENIENCE_FEE_PERCENTAGE_CARD)   || 2.9;
const convenienceFeeMobile = parseFloat(process.env.PAYMENT_CONVENIENCE_FEE_PERCENTAGE_MOBILE) || 1.5;

module.exports = {
  paystack: {
    secretKey: process.env.PAYSTACK_SECRET_KEY,
    publicKey: process.env.PAYSTACK_PUBLIC_KEY,
    baseUrl: process.env.PAYSTACK_BASE_URL || 'https://api.paystack.co',
    webhookBaseUrl: process.env.WEBHOOK_BASE_URL,
    currency: 'KES',
    environment: process.env.NODE_ENV || 'development',
    platformCommissionRate,
    convenienceFeeCard,
    convenienceFeeMobile,
    subaccountSplitPercentage: 100 - platformCommissionRate - convenienceFeeMobile // conservative default
  }
};
