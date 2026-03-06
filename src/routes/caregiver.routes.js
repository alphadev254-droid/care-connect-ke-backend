const express = require('express');
const { getCaregivers, getCaregiverById, getProfile, updateProfile, updateSpecialties, getMyPatients } = require('../controllers/caregiverController');
const { getReferralCode, getStats, sendReferralEmail } = require('../controllers/referralController');
const { authenticateToken } = require('../middleware/auth.middleware');
const { requireCaregiver } = require('../middleware/roleCheck.middleware');

const router = express.Router();

router.use(authenticateToken);

router.get('/', getCaregivers);
router.get('/profile', requireCaregiver, getProfile);
router.get('/my-patients', requireCaregiver, getMyPatients);
router.get('/:id', getCaregiverById);
router.put('/profile', requireCaregiver, updateProfile);
router.put('/specialties', requireCaregiver, updateSpecialties);

// Referral routes
router.get('/referral/code', requireCaregiver, getReferralCode);
router.get('/referral/stats', requireCaregiver, getStats);
router.post('/referral/send-email', requireCaregiver, sendReferralEmail);

module.exports = router;