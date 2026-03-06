const express = require('express');
const router = express.Router();
const {
  createAvailability,
  getAvailability,
  updateAvailability,
  deleteAvailability,
  setAvailability,
  clearAllAvailability
} = require('../controllers/availabilityController');
const { authenticateToken } = require('../middleware/auth.middleware');
const { requireRole } = require('../middleware/roleCheck.middleware');
const { USER_ROLES } = require('../utils/constants');

// CREATE - Add single availability slot
router.post('/slot', authenticateToken, requireRole([USER_ROLES.CAREGIVER]), createAvailability);

// READ - Get caregiver availability (public endpoint)
router.get('/:caregiverId', getAvailability);

// UPDATE - Update single availability slot
router.put('/:id', authenticateToken, requireRole([USER_ROLES.CAREGIVER]), updateAvailability);

// DELETE - Delete single availability slot
router.delete('/:id', authenticateToken, requireRole([USER_ROLES.CAREGIVER]), deleteAvailability);

// BULK SET - Replace all availability (legacy support)
router.post('/', authenticateToken, requireRole([USER_ROLES.CAREGIVER]), setAvailability);

// CLEAR ALL - Delete all availability for caregiver
router.delete('/', authenticateToken, requireRole([USER_ROLES.CAREGIVER]), clearAllAvailability);

module.exports = router;