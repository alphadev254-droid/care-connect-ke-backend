const express = require('express');
const {
  getCaregivers,
  getCaregiverById,
  getProfile,
  updateProfile,
  updateSpecialties,
  getVerificationProfile,
  updateVerificationProfile,
  uploadVerificationFile,
  getMyPatients
} = require('../controllers/caregiverController');
const { getReferralCode, getStats, sendReferralEmail } = require('../controllers/referralController');
const { authenticateToken } = require('../middleware/auth.middleware');
const { requireCaregiver, requireVerifiedCaregiver } = require('../middleware/roleCheck.middleware');
const { uploadMultiple, handleMulterError } = require('../middleware/upload.middleware');

const router = express.Router();

router.use(authenticateToken);

router.get('/', getCaregivers);
router.get('/profile', requireCaregiver, getProfile);
router.get('/verification', requireCaregiver, getVerificationProfile);
router.patch('/verification', requireCaregiver, updateVerificationProfile);
router.post('/verification/files', requireCaregiver, uploadMultiple, handleMulterError, uploadVerificationFile);
router.get('/my-patients', requireVerifiedCaregiver, getMyPatients);
router.put('/profile', requireVerifiedCaregiver, updateProfile);
router.put('/specialties', requireVerifiedCaregiver, updateSpecialties);

// Referral routes
router.get('/referral/code', requireVerifiedCaregiver, getReferralCode);
router.get('/referral/stats', requireVerifiedCaregiver, getStats);
router.post('/referral/send-email', requireVerifiedCaregiver, sendReferralEmail);
router.get('/:id', getCaregiverById);

module.exports = router;
