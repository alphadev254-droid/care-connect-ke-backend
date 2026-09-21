const express = require('express');
const router = express.Router();
const { generateTimeSlots, generateTimeSlotsForAvailability, getAvailableSlots, getCaregiverTimeSlots, updateTimeSlotPrice, bulkUpdateTimeSlotPrices, lockSlot, unlockSlot } = require('../controllers/timeSlotController');
const { authenticateToken } = require('../middleware/auth.middleware');
const { requireVerifiedCaregiver } = require('../middleware/roleCheck.middleware');

// Generate time slots for all availability (caregiver only)
router.post('/generate', authenticateToken, requireVerifiedCaregiver, generateTimeSlots);

// Generate time slots for specific availability (caregiver only)
router.post('/generate-for-availability', authenticateToken, requireVerifiedCaregiver, generateTimeSlotsForAvailability);

// Get available slots (public)
router.get('/available', getAvailableSlots);

// Get caregiver's time slots (authenticated)
router.get('/caregiver/:caregiverId', authenticateToken, getCaregiverTimeSlots);

// Bulk update all available time slot prices (caregiver only) - MUST come before /:id/price
router.put('/bulk/price', authenticateToken, requireVerifiedCaregiver, bulkUpdateTimeSlotPrices);

// Update time slot price (caregiver only)
router.put('/:id/price', authenticateToken, requireVerifiedCaregiver, updateTimeSlotPrice);

// Lock slot for payment (authenticated users)
router.post('/:id/lock', authenticateToken, lockSlot);

// Unlock slot (authenticated users)
router.post('/:id/unlock', authenticateToken, unlockSlot);

module.exports = router;
