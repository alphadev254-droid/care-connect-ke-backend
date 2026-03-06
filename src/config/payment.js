require('dotenv').config();

module.exports = {
  paychangu: {
    publicKey: process.env.TEST_PUBLIC_KEY,
    secretKey: process.env.TEST_SECRET_KEY,
    webhookSecret: process.env.TEST_WEBHOOK_SECRET,
    webhookBaseUrl: process.env.WEBHOOK_BASE_URL,
    apiUrl: 'https://api.paychangu.com',
    currency: 'MWK', // Malawi Kwacha
    environment: process.env.NODE_ENV || 'development',
    convenienceFeePercentage: parseFloat(process.env.PAYMENT_CONVENIENCE_FEE_PERCENTAGE) || 2,
    taxRate: parseFloat(process.env.PAYMENT_TAX_RATE) || 17.5, // Malawi VAT rate
    platformCommissionRate: parseFloat(process.env.PLATFORM_COMMISSION_RATE) || 20, // Platform commission percentage
    // Withdrawal fees
    withdrawalFees: {
      mobileMoneyRate: parseFloat(process.env.WITHDRAWAL_MOBILE_MONEY_FEE_RATE) || 0.03, // 3%
      bankRate: parseFloat(process.env.WITHDRAWAL_BANK_FEE_RATE) || 0.01, // 1%
      bankFixedFee: parseFloat(process.env.WITHDRAWAL_BANK_FIXED_FEE) || 700 // 700 MWK
    }
  }
};
