const express = require('express');
const { createRoom, getAccessToken, endSession } = require('../controllers/teleconferenceController');
const { authenticateToken } = require('../middleware/auth.middleware');

const router = express.Router();

router.use(authenticateToken);

router.post('/room', createRoom);
router.post('/token', getAccessToken);
router.post('/end/:sessionId', endSession);

module.exports = router;