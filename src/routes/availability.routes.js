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
const { requireVerifiedCaregiver } = require('../middleware/roleCheck.middleware');

// CREATE - Add single availability slot
router.post('/slot', authenticateToken, requireVerifiedCaregiver, createAvailability);

// READ - Get caregiver availability (public endpoint)
router.get('/:caregiverId', getAvailability);

// UPDATE - Update single availability slot
router.put('/:id', authenticateToken, requireVerifiedCaregiver, updateAvailability);

// DELETE - Delete single availability slot
router.delete('/:id', authenticateToken, requireVerifiedCaregiver, deleteAvailability);

// BULK SET - Replace all availability (legacy support)
router.post('/', authenticateToken, requireVerifiedCaregiver, setAvailability);

// CLEAR ALL - Delete all availability for caregiver
router.delete('/', authenticateToken, requireVerifiedCaregiver, clearAllAvailability);

module.exports = router;
