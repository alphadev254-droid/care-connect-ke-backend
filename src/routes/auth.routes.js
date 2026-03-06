const express = require('express');
const { body } = require('express-validator');
const { register, registerAdmin, login, logout, getProfile, forgotPassword, resetPassword } = require('../controllers/authController');
const { authenticateToken } = require('../middleware/auth.middleware');
const { handleValidationErrors } = require('../middleware/validator.middleware');
const { uploadMultiple, handleMulterError } = require('../middleware/upload.middleware');

const router = express.Router();

const registerValidation = [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 }),
  body('firstName').trim().notEmpty(),
  body('lastName').trim().notEmpty(),
  body('phone').trim().notEmpty(),
  body('role').optional().isIn(['patient', 'caregiver', 'primary_physician'])
];

const adminRegisterValidation = [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 }),
  body('firstName').trim().notEmpty(),
  body('lastName').trim().notEmpty(),
  body('phone').trim().notEmpty(),
  body('roleName').isIn(['caregiver', 'primary_physician', 'regional_manager', 'system_manager'])
];

const loginValidation = [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty()
];

const forgotPasswordValidation = [
  body('email').isEmail().normalizeEmail()
];

const resetPasswordValidation = [
  body('token').notEmpty(),
  body('password').isLength({ min: 6 })
];

router.post('/register', uploadMultiple, handleMulterError, registerValidation, handleValidationErrors, register);
router.post('/register-admin', adminRegisterValidation, handleValidationErrors, registerAdmin);
router.post('/login', loginValidation, handleValidationErrors, login);
router.post('/logout', logout);
router.post('/forgot-password', forgotPasswordValidation, handleValidationErrors, forgotPassword);
router.post('/reset-password', resetPasswordValidation, handleValidationErrors, resetPassword);
router.get('/profile', authenticateToken, getProfile);

module.exports = router;