require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const { createServer } = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');

const db = require('./models');
const routes = require('./routes');
const { errorHandler } = require('./middleware/errorHandler.middleware');
const { authLimiter, paymentLimiter, generalLimiter } = require('./middleware/rateLimiter');
const logger = require('./utils/logger');
const { getAllowedOrigins } = require('./utils/config');
const cleanupService = require('./services/cleanupService');
const { startEmailProcessor } = require('./jobs/emailProcessor');
const { startSettlementSync } = require('./jobs/settlementSync');

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  logger.info('✅ Uploads directory created');
}

const app = express();
const server = createServer(app);

// Parse allowed origins from environment variable (comma-separated)
const allowedOrigins = getAllowedOrigins();

logger.info('🌐 Allowed CORS origins:', allowedOrigins);
logger.info('🔧 CORS configured for mobile networks and preflight requests');

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Middleware
app.use(helmet({
  crossOriginResourcePolicy: false // Fix for African mobile ISPs
}));

// CORS configuration - bulletproof for mobile networks
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, curl, health checks)
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));
// Handle preflight requests for all routes
app.use((req, res, next) => {
  if (req.method === 'OPTIONS') {
    res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type,Authorization');
    res.header('Access-Control-Allow-Credentials', 'true');
    return res.sendStatus(204);
  }
  next();
});
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Capture raw body for Paystack webhook signature verification
app.use('/api/payments/webhook', express.raw({ type: 'application/json' }), (req, res, next) => {
  if (Buffer.isBuffer(req.body)) {
    req.rawBody = req.body;
    req.body = JSON.parse(req.body.toString());
  }
  next();
});

// Routes
app.use('/api', generalLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth/forgot-password', authLimiter);
app.use('/api/auth/reset-password', authLimiter);
app.use('/api/payments/initiate-booking', paymentLimiter);
app.use('/api/payments/initiate-session', paymentLimiter);
app.use('/api', routes);

// /uploads is NOT served statically — use /api/documents/view?token=... instead
app.use('/uploads', (req, res) => {
  return res.status(403).json({
    error: 'Direct file access is disabled. Use tokenized document URLs.'
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Error handling
app.use(errorHandler);

// Socket.IO for real-time features
io.on('connection', (socket) => {
  logger.info('User connected:', socket.id);
  
  socket.on('disconnect', () => {
    logger.info('User disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 5000;

// Initialize database and start server
async function startServer() {
  try {
    // Test database connection
    await db.sequelize.authenticate();
    logger.info('✅ Database connection established');

    // Start cleanup service for expired bookings and locked slots
    cleanupService.startCleanupJob();
    logger.info('🧹 Cleanup service started (expired bookings: every 5 minutes, overdue appointments: every hour)');

    // Start email processor
    startEmailProcessor();
    logger.info('📧 Email processor started');

    // Start settlement sync cron
    startSettlementSync();
    logger.info('💰 Settlement sync cron started');

    // Start server
    server.listen(PORT, () => {
      logger.info(`🚀 Server running on port ${PORT}`);
      logger.info('📊 Database connection ready');
      logger.info('⏱  Automatic cleanup enabled for expired bookings');
    });
  } catch (error) {
    logger.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
const shutdown = async (signal) => {
  logger.info(`\n${signal} received, starting graceful shutdown...`);

  try {
    // Stop cleanup service
    cleanupService.stopCleanupJob();
    logger.info('🛑 Cleanup service stopped');

    // Close server
    server.close(() => {
      logger.info('🔌 Server closed');
    });

    // Close database connection
    await db.sequelize.close();
    logger.info('🔌 Database connection closed');

    logger.info('✅ Graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    logger.error('❌ Error during shutdown:', error);
    process.exit(1);
  }
};

// Handle shutdown signals
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('💥 Uncaught Exception:', error);
  shutdown('UNCAUGHT_EXCEPTION');
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
  shutdown('UNHANDLED_REJECTION');
});

startServer();

module.exports = { app, server, io };