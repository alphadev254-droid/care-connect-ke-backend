const rateLimit = require('express-rate-limit');

const handler = (req, res) => {
  res.status(429).json({ error: 'Too many requests. Please try again later.' });
};

// Strict: login, register, forgot password — prevent brute force
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler
});

// Payments — prevent abuse of payment initiation
const paymentLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler
});

// General API — broad protection for all other routes
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  handler
});

module.exports = { authLimiter, paymentLimiter, generalLimiter };
