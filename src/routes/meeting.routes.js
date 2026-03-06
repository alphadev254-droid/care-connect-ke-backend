const express = require('express');
const router = express.Router();
const meetingController = require('../controllers/meetingController');
const { authenticateToken, requireRole } = require('../middleware/auth.middleware');

/**
 * Public endpoint - No authentication required
 * Users access this via magic link from email
 */
router.get('/join/:token', meetingController.joinMeetingWithToken);

/**
 * Track meeting events - No authentication required
 * Called from frontend when users join/leave Jitsi
 */
router.post('/track/join', meetingController.trackMeetingJoin);
router.post('/track/leave', meetingController.trackMeetingLeave);

/**
 * Admin endpoints - Require authentication and admin role
 */
const adminRoles = ['system_manager', 'regional_manager', 'Accountant'];

router.get('/settings', authenticateToken, requireRole(adminRoles), meetingController.getMeetingSettings);
router.put('/settings', authenticateToken, requireRole(adminRoles), meetingController.updateMeetingSettings);
router.get('/sessions', authenticateToken, requireRole(adminRoles), meetingController.getTeleconferenceSessions);
router.get('/sessions/:sessionId', authenticateToken, requireRole(adminRoles), meetingController.getSessionDetails);
router.post('/sessions/:appointmentId/regenerate-tokens', authenticateToken, requireRole(adminRoles), meetingController.regenerateMeetingTokens);
router.delete('/sessions/:sessionId', authenticateToken, requireRole(adminRoles), meetingController.deleteSession);
router.get('/statistics', authenticateToken, requireRole(adminRoles), meetingController.getSessionStatistics);

module.exports = router;
