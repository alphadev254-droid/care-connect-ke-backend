const axios = require('axios');
const crypto = require('crypto');
const paymentConfig = require('../config/payment');
const logger = require('../utils/logger');

const api = axios.create({
  baseURL: paymentConfig.paystack.baseUrl,
  headers: {
    Authorization: `Bearer ${paymentConfig.paystack.secretKey}`,
    'Content-Type': 'application/json'
  }
});

/**
 * Create a Paystack subaccount for a caregiver
 */
const createSubaccount = async ({ businessName, settlementBank, accountNumber, percentageCharge = 78 }) => {
  try {
    const response = await api.post('/subaccount', {
      business_name: businessName,
      settlement_bank: settlementBank,
      account_number: accountNumber,
      percentage_charge: percentageCharge
    });
    logger.info(`Paystack subaccount created: ${response.data.data.subaccount_code}`);
    return response.data.data;
  } catch (error) {
    logger.error('Paystack createSubaccount failed:', error.response?.data || error.message);
    throw new Error(error.response?.data?.message || 'Failed to create Paystack subaccount');
  }
};

/**
 * Initialize a payment transaction
 * bearer: 'account' means platform bears Paystack's own processing fee
 * transaction_charge: amount platform keeps (commission + convenience fee) in kobo
 */
const initializePayment = async ({ email, amount, tx_ref, subaccountCode, transactionCharge, callbackUrl, returnUrl, metadata, channels }) => {
  try {
    const payload = {
      email,
      amount: Math.round(amount * 100), // kobo
      currency: paymentConfig.paystack.currency,
      reference: tx_ref,
      callback_url: callbackUrl,
      metadata: { ...metadata, cancel_action: returnUrl }
    };

    if (channels && channels.length > 0) {
      payload.channels = channels;
    }

    if (subaccountCode) {
      payload.subaccount = subaccountCode;
      payload.transaction_charge = Math.round(transactionCharge * 100); // kobo
      payload.bearer = 'account';
    }

    const response = await api.post('/transaction/initialize', payload);
    logger.info(`Paystack payment initialized: ${tx_ref}`);
    return response.data.data; // { authorization_url, access_code, reference }
  } catch (error) {
    logger.error('Paystack initializePayment failed:', error.response?.data || error.message);
    throw new Error(error.response?.data?.message || 'Failed to initialize payment');
  }
};

/**
 * Verify a payment by reference
 */
const verifyPayment = async (reference) => {
  try {
    const response = await api.get(`/transaction/verify/${reference}`);
    return response.data.data;
  } catch (error) {
    logger.error('Paystack verifyPayment failed:', error.response?.data || error.message);
    throw new Error(error.response?.data?.message || 'Failed to verify payment');
  }
};

/**
 * Verify Paystack webhook signature
 * Uses HMAC-SHA512 of raw body with secret key
 */
const verifyWebhookSignature = (rawBody, signature) => {
  const hash = crypto
    .createHmac('sha512', paymentConfig.paystack.secretKey)
    .update(rawBody)
    .digest('hex');
  return hash === signature;
};

/**
 * Fetch settlements for a subaccount from Paystack
 */
const fetchSettlements = async (subaccountCode) => {
  try {
    const response = await api.get('/settlement', {
      params: { subaccount: subaccountCode, perPage: 100 }
    });
    return response.data.data || [];
  } catch (error) {
    logger.error(`Paystack fetchSettlements failed for ${subaccountCode}:`, error.response?.data || error.message);
    throw new Error(error.response?.data?.message || 'Failed to fetch settlements');
  }
};

/**
 * Get list of Kenyan banks and M-PESA from Paystack
 */
const getBanks = async () => {
  try {
    const response = await api.get('/bank', { params: { country: 'kenya', perPage: 100 } });
    const banks = response.data.data || [];
    // Filter: KES currency or mobile_money type, active, not deleted, deduplicate by code
    const seen = new Set();
    return banks
      .filter(b => (b.currency === 'KES' || b.type === 'mobile_money') && b.active && !b.is_deleted)
      .filter(b => {
        if (seen.has(b.code)) return false;
        seen.add(b.code);
        return true;
      })
      .map(b => ({ name: b.name, code: b.code, type: b.type }));
  } catch (error) {
    logger.error('Paystack getBanks failed:', error.response?.data || error.message);
    throw new Error('Failed to fetch banks');
  }
};

/**
 * Calculate fee breakdown for a payment
 * baseFee: the session/booking fee
 * channel: 'card' | 'mobile_money' (determines convenience fee rate)
 */
const calculateFees = (baseFee, channel = 'mobile_money') => {
  const { platformCommissionRate, convenienceFeeCard, convenienceFeeMobile } = paymentConfig.paystack;
  const convenienceFeePercentage = channel === 'card' ? convenienceFeeCard : convenienceFeeMobile;
  const convenienceFee = Math.max(1, Math.ceil((baseFee * convenienceFeePercentage) / 100));
  const platformCommission = parseFloat(((baseFee * platformCommissionRate) / 100).toFixed(2));
  const caregiverEarnings = parseFloat((baseFee - platformCommission).toFixed(2));
  const totalAmount = parseFloat((baseFee + convenienceFee).toFixed(2));
  const transactionCharge = parseFloat((platformCommission + convenienceFee).toFixed(2));

  return {
    baseFee,
    channel,
    convenienceFee,
    platformCommissionRate,
    platformCommission,
    caregiverEarnings,
    totalAmount,
    transactionCharge
  };
};

module.exports = {
  createSubaccount,
  initializePayment,
  verifyPayment,
  verifyWebhookSignature,
  fetchSettlements,
  getBanks,
  calculateFees
};
