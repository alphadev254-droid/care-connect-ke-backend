const { Referral, Caregiver, Patient, User } = require('../models');
const { getPrimaryFrontendUrl } = require('../utils/config');
const emailService = require('../services/emailService');
const crypto = require('crypto');

/**
 * Generate or retrieve referral code for a caregiver
 * GET /api/caregivers/referral/code
 */
const getReferralCode = async (req, res, next) => {
  try {
    // Get caregiver from authenticated user
    const caregiverId = req.user.Caregiver?.id;

    if (!caregiverId) {
      return res.status(403).json({
        success: false,
        message: 'Only caregivers can generate referral codes'
      });
    }

    // Check if caregiver already has a referral code
    let referral = await Referral.findOne({
      where: { caregiverId },
      order: [['createdAt', 'DESC']]
    });

    // Generate new code if none exists
    if (!referral) {
      let isUnique = false;
      let referralCode;

      // Generate unique code (retry if collision)
      while (!isUnique) {
        referralCode = 'CARE' + crypto.randomBytes(3).toString('hex').toUpperCase();
        const existing = await Referral.findOne({ where: { referralCode } });
        if (!existing) {
          isUnique = true;
        }
      }

      referral = await Referral.create({
        caregiverId,
        referralCode,
        status: 'pending'
      });
    }

    // Generate shareable link
    const frontendUrl = getPrimaryFrontendUrl();
    const referralLink = `${frontendUrl}/register?ref=${referral.referralCode}`;

    // Get referral stats
    const stats = await getReferralStats(caregiverId);

    res.json({
      success: true,
      referralCode: referral.referralCode,
      referralLink,
      stats
    });
  } catch (error) {
    console.error('Error getting referral code:', error);
    next(error);
  }
};

/**
 * Get referral statistics for a caregiver
 * Helper function used by getReferralCode and getStats endpoint
 */
const getReferralStats = async (caregiverId) => {
  const totalConverted = await Referral.count({
    where: { caregiverId, status: 'converted' }
  });

  const pendingReferrals = await Referral.count({
    where: { caregiverId, status: 'pending' }
  });

  const caregiver = await Caregiver.findByPk(caregiverId);

  return {
    totalConverted,
    pendingClicks: pendingReferrals,
    boostScore: caregiver?.referralBoostScore || 0,
    referralCount: caregiver?.referralCount || 0
  };
};

/**
 * Get detailed referral statistics
 * GET /api/caregivers/referral/stats
 */
const getStats = async (req, res, next) => {
  try {
    const caregiverId = req.user.Caregiver?.id;

    if (!caregiverId) {
      return res.status(403).json({
        success: false,
        message: 'Only caregivers can view referral stats'
      });
    }

    const stats = await getReferralStats(caregiverId);

    res.json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('Error getting referral stats:', error);
    next(error);
  }
};

/**
 * Send referral invitation via email
 * POST /api/caregivers/referral/send-email
 */
const sendReferralEmail = async (req, res, next) => {
  try {
    const { recipientEmail, personalMessage } = req.body;
    const caregiverId = req.user.Caregiver?.id;

    if (!caregiverId) {
      return res.status(403).json({
        success: false,
        message: 'Only caregivers can send referral emails'
      });
    }

    // Validate recipient email
    if (!recipientEmail || !recipientEmail.includes('@')) {
      return res.status(400).json({
        success: false,
        message: 'Valid recipient email is required'
      });
    }

    // Get caregiver details
    const caregiver = await Caregiver.findByPk(caregiverId, {
      include: [{ model: User }]
    });

    if (!caregiver || !caregiver.User) {
      return res.status(404).json({
        success: false,
        message: 'Caregiver not found'
      });
    }

    // Get or generate referral code
    let referral = await Referral.findOne({
      where: { caregiverId },
      order: [['createdAt', 'DESC']]
    });

    if (!referral) {
      let isUnique = false;
      let referralCode;

      while (!isUnique) {
        referralCode = 'CARE' + crypto.randomBytes(3).toString('hex').toUpperCase();
        const existing = await Referral.findOne({ where: { referralCode } });
        if (!existing) {
          isUnique = true;
        }
      }

      referral = await Referral.create({
        caregiverId,
        referralCode,
        status: 'pending'
      });
    }

    // Generate referral link
    const frontendUrl = getPrimaryFrontendUrl();
    const referralLink = `${frontendUrl}/register?ref=${referral.referralCode}`;

    // Send email
    const caregiverName = `${caregiver.User.firstName} ${caregiver.User.lastName}`;

    await emailService.sendReferralInvitation({
      recipientEmail,
      caregiverName,
      referralLink,
      personalMessage: personalMessage || ''
    });

    res.json({
      success: true,
      message: 'Referral email sent successfully'
    });
  } catch (error) {
    console.error('Error sending referral email:', error);
    next(error);
  }
};

module.exports = {
  getReferralCode,
  getStats,
  sendReferralEmail
};
