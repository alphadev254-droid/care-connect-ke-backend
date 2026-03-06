const express = require('express');
const router = express.Router();

// Get platform commission rate
router.get('/platform-commission', (req, res) => {
  try {
    const commission = parseFloat(process.env.PLATFORM_COMMISSION_RATE) || 20;
    res.json({ commission });
  } catch (error) {
    console.error('Error fetching platform commission:', error);
    res.status(500).json({ error: 'Failed to fetch platform commission' });
  }
});

module.exports = router;