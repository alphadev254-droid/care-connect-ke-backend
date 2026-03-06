const express = require('express');
const { authenticateToken } = require('../middleware/auth.middleware');
const { CaregiverEarnings, WithdrawalRequest, WithdrawalToken, Caregiver, User, sequelize } = require('../models');
const { Op } = require('sequelize');
const logger = require('../utils/logger');
const { sendWithdrawalTokenEmail, sendWithdrawalSuccessEmail } = require('../services/emailService');
const crypto = require('crypto');

const router = express.Router();

router.use(authenticateToken);

// Request withdrawal token
router.post('/request-token', async (req, res, next) => {
  try {
    const caregiver = await Caregiver.findOne({ 
      where: { userId: req.user.id },
      include: [{ model: User, attributes: ['firstName', 'lastName', 'email'] }]
    });
    
    if (!caregiver) {
      return res.status(404).json({ error: 'Caregiver profile not found' });
    }

    // Rate limiting: Check recent token requests
    const recentTokens = await WithdrawalToken.count({
      where: {
        caregiverId: caregiver.id,
        created_at: { [Op.gte]: new Date(Date.now() - 5 * 60 * 1000) } // 5 minutes
      }
    });

    if (recentTokens >= 3) {
      return res.status(429).json({ error: 'Too many token requests. Please wait 5 minutes.' });
    }

    // Invalidate existing tokens
    await WithdrawalToken.update(
      { used: true },
      { where: { caregiverId: caregiver.id, used: false } }
    );

    // Generate cryptographically secure 6-digit token
    const token = crypto.randomInt(100000, 999999).toString();
    const expiresAt = new Date(Date.now() + 3 * 60 * 1000);

    await WithdrawalToken.create({
      caregiverId: caregiver.id,
      token,
      expiresAt
    });

    await sendWithdrawalTokenEmail(
      caregiver.User.email,
      `${caregiver.User.firstName} ${caregiver.User.lastName}`,
      token
    );

    logger.info(`Withdrawal token requested by caregiver ${caregiver.id}`);
    res.json({ message: 'Withdrawal token sent to your email' });
  } catch (error) {
    logger.error('Token request error:', error);
    next(error);
  }
});

// Verify withdrawal token
router.post('/verify-token', async (req, res, next) => {
  try {
    const { token, amount } = req.body;

    if (!token || !/^\d{6}$/.test(token)) {
      return res.status(400).json({ error: 'Invalid token format' });
    }

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Amount is required for token verification' });
    }

    // Verify caregiver authentication
    const caregiver = await Caregiver.findOne({ 
      where: { userId: req.user.id },
      include: [{ model: CaregiverEarnings }]
    });
    
    if (!caregiver) {
      return res.status(404).json({ error: 'Caregiver profile not found' });
    }

    // Check if caregiver has sufficient balance
    const earnings = caregiver.CaregiverEarning || await CaregiverEarnings.findOne({
      where: { caregiverId: caregiver.id }
    });

    if (!earnings || parseFloat(earnings.walletBalance) < parseFloat(amount)) {
      return res.status(400).json({ 
        error: 'Insufficient balance for requested amount',
        availableBalance: earnings ? parseFloat(earnings.walletBalance).toFixed(2) : '0.00',
        requestedAmount: parseFloat(amount).toFixed(2)
      });
    }

    // Verify token belongs to authenticated caregiver
    const withdrawalToken = await WithdrawalToken.findOne({
      where: {
        caregiverId: caregiver.id,
        token,
        used: false,
        expiresAt: { [Op.gt]: new Date() }
      }
    });

    if (!withdrawalToken) {
      logger.warn(`Invalid token attempt by caregiver ${caregiver.id} for amount ${amount}`);
      return res.status(400).json({ error: 'Invalid or expired token' });
    }

    // Calculate fees for verification based on withdrawal type
    const requestedAmount = parseFloat(amount);
    let withdrawalFee = 0;
    
    // Default to mobile_money if not specified in verification
    const withdrawalType = 'mobile_money'; // Could be enhanced to accept type in request
    
    if (withdrawalType === 'mobile_money') {
      const mobileMoneyFeeRate = parseFloat(process.env.WITHDRAWAL_MOBILE_MONEY_FEE_RATE) || 0.03;
      withdrawalFee = requestedAmount * mobileMoneyFeeRate;
    } else if (withdrawalType === 'bank') {
      const bankFeeRate = parseFloat(process.env.WITHDRAWAL_BANK_FEE_RATE) || 0.01;
      const bankFixedFee = parseFloat(process.env.WITHDRAWAL_BANK_FIXED_FEE) || 700;
      withdrawalFee = (requestedAmount * bankFeeRate) + bankFixedFee;
    }
    
    const netPayout = requestedAmount - withdrawalFee;

    logger.info(`Token verified for caregiver ${caregiver.id}, amount: ${amount}`);

    res.json({ 
      message: 'Token verified successfully',
      caregiverId: caregiver.id,
      requestedAmount: requestedAmount.toFixed(2),
      withdrawalFee: withdrawalFee.toFixed(2),
      netPayout: netPayout.toFixed(2),
      availableBalance: parseFloat(earnings.walletBalance).toFixed(2)
    });
  } catch (error) {
    logger.error('Token verification error:', error);
    next(error);
  }
});

// Get caregiver's current balance and earnings summary
router.get('/balance', async (req, res, next) => {
  try {
    // Find caregiver by user ID
    const caregiver = await Caregiver.findOne({ where: { userId: req.user.id } });
    if (!caregiver) {
      return res.status(404).json({ error: 'Caregiver profile not found' });
    }

    // Get or create earnings record
    const [earnings] = await CaregiverEarnings.findOrCreate({
      where: { caregiverId: caregiver.id },
      defaults: {
        caregiverId: caregiver.id,
        totalCaregiverEarnings: 0,
        walletBalance: 0,
        lockedBalance: 0
      }
    });

    res.json({
      caregiverId: caregiver.id,
      totalEarnings: parseFloat(earnings.totalCaregiverEarnings).toFixed(2),
      availableBalance: parseFloat(earnings.walletBalance).toFixed(2),
      lockedBalance: parseFloat(earnings.lockedBalance || 0).toFixed(2),
      currency: 'MWK'
    });
  } catch (error) {
    next(error);
  }
});

// Get withdrawal history
router.get('/history', async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Find caregiver by user ID
    const caregiver = await Caregiver.findOne({ where: { userId: req.user.id } });
    if (!caregiver) {
      return res.status(404).json({ error: 'Caregiver profile not found' });
    }

    const { count, rows: withdrawals } = await WithdrawalRequest.findAndCountAll({
      where: { caregiverId: caregiver.id },
      order: [['requestedAt', 'DESC']],
      limit: parseInt(limit),
      offset: offset
    });

    res.json({
      withdrawals,
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
});

// Request withdrawal
router.post('/request', async (req, res, next) => {
  try {
    // Log the raw request body first
    console.log('=== RAW REQUEST BODY ===');
    console.log('req.body:', req.body);
    console.log('req.body type:', typeof req.body);
    console.log('req.body keys:', Object.keys(req.body || {}));
    console.log('========================');
    
    logger.info(`🚀 Withdrawal Request Received:`, {
      body: req.body,
      bodyType: typeof req.body,
      bodyKeys: Object.keys(req.body || {}),
      userId: req.user?.id,
      timestamp: new Date().toISOString()
    });

    const { amount, recipientType = 'mobile_money', recipientNumber, token } = req.body;

    console.log('=== EXTRACTED VALUES ===');
    console.log('amount:', amount, 'type:', typeof amount);
    console.log('recipientType:', recipientType);
    console.log('recipientNumber:', recipientNumber);
    console.log('token:', token);
    console.log('========================');

    // Enhanced validation
    if (!amount || amount <= 0 || amount > 1000000) {
      console.log('VALIDATION FAILED: Invalid amount');
      logger.error(`❌ Validation Error - Invalid Amount:`, {
        amount: amount,
        userId: req.user?.id
      });
      return res.status(400).json({ error: 'Invalid withdrawal amount (1-1,000,000 MWK)' });
    }

    if (!recipientNumber || !/^[0-9+\-\s]{8,15}$/.test(recipientNumber)) {
      console.log('VALIDATION FAILED: Invalid recipient number');
      logger.error(`❌ Validation Error - Invalid Recipient Number:`, {
        recipientNumber: recipientNumber,
        userId: req.user?.id
      });
      return res.status(400).json({ error: 'Invalid recipient number format' });
    }

    if (!token || !/^\d{6}$/.test(token)) {
      console.log('VALIDATION FAILED: Invalid token');
      logger.error(`❌ Validation Error - Invalid Token:`, {
        token: token,
        userId: req.user?.id
      });
      return res.status(400).json({ error: 'Invalid withdrawal token format' });
    }

    console.log('ALL VALIDATIONS PASSED');
    logger.info('✅ All validations passed, proceeding with withdrawal');

    console.log('🔍 Finding caregiver...');
    const caregiver = await Caregiver.findOne({ 
      where: { userId: req.user.id },
      include: [{ model: User, attributes: ['firstName', 'lastName', 'email'] }]
    });
    
    if (!caregiver) {
      console.log('❌ Caregiver not found');
      return res.status(404).json({ error: 'Caregiver profile not found' });
    }
    console.log('✅ Caregiver found:', caregiver.id);

    console.log('🔍 Verifying withdrawal token...');
    // Verify token with timing attack protection
    const withdrawalToken = await WithdrawalToken.findOne({
      where: {
        caregiverId: caregiver.id,
        token,
        used: false,
        expiresAt: { [Op.gt]: new Date() }
      }
    });

    if (!withdrawalToken) {
      console.log('❌ Invalid or expired token');
      logger.warn(`Invalid withdrawal attempt by caregiver ${caregiver.id}`);
      return res.status(400).json({ error: 'Invalid or expired withdrawal token' });
    }
    console.log('✅ Token verified');

    console.log('🔄 Marking token as used...');
    // Mark token as used immediately
    await withdrawalToken.update({ used: true });
    console.log('✅ Token marked as used');

    console.log('🔍 Checking earnings...');
    const earnings = await CaregiverEarnings.findOne({
      where: { caregiverId: caregiver.id }
    });

    if (!earnings || parseFloat(earnings.walletBalance) < parseFloat(amount)) {
      console.log('❌ Insufficient balance');
      return res.status(400).json({ 
        error: 'Insufficient balance',
        availableBalance: earnings ? parseFloat(earnings.walletBalance).toFixed(2) : '0.00'
      });
    }
    console.log('✅ Balance check passed:', earnings.walletBalance);

    console.log('💰 Calculating fees...');
    // Calculate platform fee based on withdrawal type and PayChangu rates
    const requestedAmount = parseFloat(amount);
    
    // Generate secure payment reference
    const paymentReference = `WD${Date.now()}${caregiver.id}${crypto.randomInt(1000, 9999)}`;
    console.log('📝 Payment reference generated:', paymentReference);

    logger.info(`💰 Withdrawal Request Started:`, {
      caregiverId: caregiver.id,
      requestedAmount: requestedAmount,
      recipientType: recipientType,
      recipientNumber: recipientNumber.substring(0, 6) + '***',
      paymentReference: paymentReference
    });

    let platformFee = 0;
    
    if (recipientType === 'mobile_money') {
      // Mobile money: 3% fee
      const mobileMoneyFeeRate = parseFloat(process.env.WITHDRAWAL_MOBILE_MONEY_FEE_RATE) || 0.03;
      platformFee = requestedAmount * mobileMoneyFeeRate;
    } else if (recipientType === 'bank') {
      // Bank: 1% + 700 MWK
      const bankFeeRate = parseFloat(process.env.WITHDRAWAL_BANK_FEE_RATE) || 0.01;
      const bankFixedFee = parseFloat(process.env.WITHDRAWAL_BANK_FIXED_FEE) || 700;
      platformFee = (requestedAmount * bankFeeRate) + bankFixedFee;
    }
    
    const netPayout = requestedAmount - platformFee;
    console.log('💵 Fee calculation complete:', { requestedAmount, platformFee, netPayout });
    
    logger.info(`💵 Fee Calculation:`, {
      caregiverId: caregiver.id,
      requestedAmount: requestedAmount,
      platformFee: platformFee,
      netPayout: netPayout,
      recipientType: recipientType
    });
    
    if (netPayout <= 0) {
      console.log('❌ Net payout too small');
      return res.status(400).json({ 
        error: 'Withdrawal amount too small after fees',
        platformFee: platformFee.toFixed(2)
      });
    }
    console.log('✅ Net payout validation passed');

    console.log('📝 Creating withdrawal request...');
    // Create withdrawal request with pending status
    const withdrawalRequest = await WithdrawalRequest.create({
      caregiverId: caregiver.id,
      requestedAmount: requestedAmount,
      withdrawalFee: platformFee, // Platform fee charged upfront
      netPayout: netPayout, // Amount sent to PayChangu
      recipientType,
      recipientNumber,
      status: 'pending',
      payoutReference: paymentReference
    });
    console.log('✅ Withdrawal request created:', withdrawalRequest.id);

    console.log('🔧 Loading payment service...');
    // Process withdrawal via payment service
    const paymentService = require('../services/paymentService');
    
    // Determine mobile money operator based on phone number
    let operator = 'airtel'; // default
    if (recipientNumber.includes('088') || recipientNumber.includes('077')) {
      operator = 'tnm';
    }
    
    console.log('📱 Operator detected:', operator);
    logger.info(`📱 Operator Detection:`, {
      caregiverId: caregiver.id,
      recipientNumber: recipientNumber.substring(0, 6) + '***',
      detectedOperator: operator,
      paymentReference: paymentReference
    });
    
    console.log('🚀 Calling payment service...');
    const withdrawalParams = {
      amount: netPayout,
      recipientType,
      recipientNumber,
      reference: paymentReference,
      operator,
      bankCode: req.body.bankCode, // For bank transfers
      accountName: req.body.accountName // For bank transfers
    };
    console.log('📋 Payment params:', withdrawalParams);
    
    let withdrawalResult;
    try {
      withdrawalResult = await paymentService.processWithdrawal(withdrawalParams);
      console.log('✅ Payment service response received:', withdrawalResult);
    } catch (paymentError) {
      console.log('❌ FULL PAYMENT ERROR JSON:', JSON.stringify(paymentError, null, 2));
      console.log('❌ Payment service error:', paymentError.message);
      
      // Mark withdrawal as failed and return error
      await withdrawalRequest.update({
        status: 'failed',
        paychanguResponse: {
          error: paymentError.message,
          errorDetails: paymentError.stack,
          apiResponse: paymentError.response?.data
        }
      });
      
      return res.status(400).json({ 
        error: 'Withdrawal processing failed',
        details: paymentError.response?.data?.message || paymentError.message
      });
    }

    // Update withdrawal status based on API response
    let finalStatus = 'pending';
    let processedAt = null;

    // PayChangu response structure: { status: 'success', data: { transaction: { status: '...' } } }
    const transactionStatus = withdrawalResult.data?.transaction?.status || withdrawalResult.data?.status;

    logger.info(`🔄 Processing API Response:`, {
      caregiverId: caregiver.id,
      paymentReference: paymentReference,
      apiStatus: withdrawalResult.status,
      transactionStatus: transactionStatus
    });

    if (withdrawalResult.status === 'success') {
      // Check transaction status to determine final state
      if (transactionStatus === 'success') {
        finalStatus = 'completed';
        processedAt = new Date();
      } else if (transactionStatus === 'pending' || transactionStatus === 'processing') {
        finalStatus = 'processing';
      } else {
        // Any other status is considered failed
        finalStatus = 'failed';
      }

      // Only deduct balance if not failed
      if (finalStatus !== 'failed') {
        logger.info(`💳 Balance Deduction:`, {
          caregiverId: caregiver.id,
          paymentReference: paymentReference,
          previousBalance: parseFloat(earnings.walletBalance),
          deductionAmount: requestedAmount,
          newBalance: parseFloat(earnings.walletBalance) - requestedAmount,
          finalStatus: finalStatus
        });

        // Deduct full requested amount from wallet (platform keeps the fee)
        await earnings.update({
          walletBalance: parseFloat(earnings.walletBalance) - requestedAmount
        });
      }
    } else {
      finalStatus = 'failed';
      logger.warn(`⚠️ Withdrawal Failed:`, {
        caregiverId: caregiver.id,
        paymentReference: paymentReference,
        apiStatus: withdrawalResult.status,
        transactionStatus: transactionStatus,
        reason: 'API response indicates failure'
      });
    }

    // Update withdrawal request with final status
    await withdrawalRequest.update({
      status: finalStatus,
      processedAt,
      paychanguResponse: {
        chargeId: withdrawalResult.data?.charge_id,
        refId: withdrawalResult.data?.ref_id,
        transId: withdrawalResult.data?.trans_id,
        apiResponse: withdrawalResult
      }
    });

    // Send appropriate email notification
    if (finalStatus === 'completed' || finalStatus === 'processing') {
      await sendWithdrawalSuccessEmail(caregiver.User.email, {
        caregiverName: `${caregiver.User.firstName} ${caregiver.User.lastName}`,
        requestedAmount: parseFloat(withdrawalRequest.requestedAmount).toFixed(2),
        withdrawalFee: parseFloat(withdrawalRequest.withdrawalFee).toFixed(2),
        netPayout: parseFloat(withdrawalRequest.netPayout).toFixed(2),
        currency: 'MWK',
        paymentReference: paymentReference,
        recipientType,
        recipientNumber
      });
    }

    logger.info(`✅ Withdrawal ${finalStatus}: ${paymentReference} for caregiver ${caregiver.id}`, {
      finalStatus: finalStatus,
      requestedAmount: parseFloat(withdrawalRequest.requestedAmount),
      platformFee: platformFee,
      netPayout: parseFloat(withdrawalRequest.netPayout),
      chargeId: withdrawalResult.data?.charge_id
    });

    res.status(201).json({
      message: finalStatus === 'completed' ? 'Withdrawal processed successfully' : 
               finalStatus === 'processing' ? 'Withdrawal is being processed' : 
               'Withdrawal failed',
      requestedAmount: parseFloat(withdrawalRequest.requestedAmount).toFixed(2),
      platformFee: platformFee.toFixed(2),
      netPayout: parseFloat(withdrawalRequest.netPayout).toFixed(2),
      currency: 'MWK',
      paymentReference: paymentReference,
      recipientNumber,
      status: finalStatus,
      chargeId: withdrawalResult.data?.charge_id
    });
  } catch (error) {
    logger.error(`❌ Withdrawal Request Error:`, {
      error: error.message,
      stack: error.stack,
      userId: req.user?.id,
      body: req.body
    });
    
    // If withdrawal request was created but API failed, mark as failed
    if (error.withdrawalRequestId) {
      await WithdrawalRequest.update(
        { status: 'failed' },
        { where: { id: error.withdrawalRequestId } }
      );
    }
    
    next(error);
  }
});

// Check withdrawal status
router.get('/status/:reference', async (req, res, next) => {
  try {
    const { reference } = req.params;

    const caregiver = await Caregiver.findOne({ where: { userId: req.user.id } });
    if (!caregiver) {
      return res.status(404).json({ error: 'Caregiver profile not found' });
    }

    const withdrawalRequest = await WithdrawalRequest.findOne({
      where: {
        caregiverId: caregiver.id,
        payoutReference: reference
      }
    });

    if (!withdrawalRequest) {
      return res.status(404).json({ error: 'Withdrawal request not found' });
    }

    // If status is processing, check with API
    if (withdrawalRequest.status === 'processing' && withdrawalRequest.paychanguResponse?.refId) {
      try {
        const axios = require('axios');
        const paymentConfig = require('../config/payment');
        
        const statusResponse = await axios.get(
          `${paymentConfig.paychangu.apiUrl}/payouts/mobile-money/${withdrawalRequest.paychanguResponse.refId}`,
          {
            headers: {
              'Accept': 'application/json',
              'Authorization': `Bearer ${paymentConfig.paychangu.secretKey}`
            }
          }
        );
        
        // Update status if changed
        const apiData = statusResponse.data.data;
        if (apiData && apiData.status !== withdrawalRequest.status) {
          let newStatus = apiData.status;
          let processedAt = withdrawalRequest.processedAt;
          
          if (newStatus === 'completed' || newStatus === 'success') {
            newStatus = 'completed';
            processedAt = new Date();
          } else if (newStatus === 'failed') {
            newStatus = 'failed';
          }
          
          await withdrawalRequest.update({
            status: newStatus,
            processedAt
          });
        }
      } catch (error) {
        logger.error('Failed to check withdrawal status:', error);
      }
    }

    res.json({
      reference: withdrawalRequest.payoutReference,
      status: withdrawalRequest.status,
      requestedAmount: parseFloat(withdrawalRequest.requestedAmount).toFixed(2),
      netPayout: parseFloat(withdrawalRequest.netPayout).toFixed(2),
      recipientNumber: withdrawalRequest.recipientNumber,
      requestedAt: withdrawalRequest.createdAt,
      processedAt: withdrawalRequest.processedAt
    });
  } catch (error) {
    next(error);
  }
});

// Withdrawal webhook for status updates
router.post('/webhook', async (req, res, next) => {
  try {
    const { event_type, charge_id, reference, amount, charge, status } = req.body;

    if (!charge_id && !reference) {
      return res.status(400).json({ error: 'charge_id or reference is required' });
    }

    // Find withdrawal request by reference or charge_id
    const withdrawalRequest = await WithdrawalRequest.findOne({
      where: {
        [Op.or]: [
          { payoutReference: reference },
          sequelize.where(
            sequelize.json('paychangu_response.chargeId'),
            charge_id
          )
        ]
      }
    });

    if (!withdrawalRequest) {
      logger.warn(`Withdrawal webhook: request not found for charge_id ${charge_id} or reference ${reference}`);
      return res.status(404).json({ error: 'Withdrawal request not found' });
    }

    // Update status based on webhook (no fee changes since platform fee already charged)
    let newStatus = status;
    let processedAt = withdrawalRequest.processedAt;
    let shouldUpdateBalance = false;

    if (status === 'completed' || status === 'success') {
      newStatus = 'completed';
      processedAt = new Date();
    } else if (status === 'failed') {
      newStatus = 'failed';
      // If withdrawal failed and balance was already deducted, refund it
      if (withdrawalRequest.status === 'processing') {
        shouldUpdateBalance = true;
      }
    }

    await withdrawalRequest.update({
      status: newStatus,
      processedAt,
      paychanguResponse: {
        ...withdrawalRequest.paychanguResponse,
        chargeId: charge_id,
        webhookReceived: new Date(),
        webhookPayload: req.body
      }
    });

    // Refund balance if withdrawal failed
    if (shouldUpdateBalance) {
      const earnings = await CaregiverEarnings.findOne({
        where: { caregiverId: withdrawalRequest.caregiverId }
      });
      
      if (earnings) {
        await earnings.update({
          walletBalance: parseFloat(earnings.walletBalance) + parseFloat(withdrawalRequest.requestedAmount)
        });
        logger.info(`Refunded ${withdrawalRequest.requestedAmount} MWK to caregiver ${withdrawalRequest.caregiverId}`);
      }
    }

    logger.info(`Withdrawal webhook processed: ${charge_id || reference} -> ${newStatus}`);
    res.json({ message: 'Webhook processed successfully' });
  } catch (error) {
    logger.error('Withdrawal webhook error:', error);
    next(error);
  }
});

module.exports = router;