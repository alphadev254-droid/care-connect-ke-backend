const express = require('express');
const { getProfile, updateProfile, changePassword, getSettings, updateSettings } = require('../controllers/userController');
const { authenticateToken } = require('../middleware/auth.middleware');
const { uploadMultiple } = require('../middleware/upload.middleware');

const router = express.Router();

router.use(authenticateToken);

router.get('/profile', getProfile);
router.put('/profile', uploadMultiple, updateProfile);
router.put('/change-password', require('../controllers/passwordController').changePassword);
router.put('/change-password', changePassword);
router.get('/settings', getSettings);
router.put('/settings', updateSettings);

module.exports = router;