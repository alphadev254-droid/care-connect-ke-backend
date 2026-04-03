const rateLimit = require('express-rate-limit');

const handler = (req, res) => {
  res.status(429).json({ error: 'Too many requests. Please try again later.' });
};

const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 0, // 0 = unlimited
  standardHeaders: true,
  legacyHeaders: false,
  handler
});

const paymentLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 0,
  standardHeaders: true,
  legacyHeaders: false,
  handler
});

const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 0,
  standardHeaders: true,
  legacyHeaders: false,
  handler
});

module.exports = { authLimiter, paymentLimiter, generalLimiter };
