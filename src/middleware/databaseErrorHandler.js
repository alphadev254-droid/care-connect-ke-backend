const { SequelizeDatabaseError, SequelizeConnectionError } = require('sequelize');

/**
 * Database error handling middleware
 */
const handleDatabaseErrors = (error, req, res, next) => {
  console.error('Database error occurred:', {
    name: error.name,
    message: error.message,
    code: error.original?.code,
    errno: error.original?.errno,
    sqlState: error.original?.sqlState,
    url: req.url,
    method: req.method
  });

  // Handle specific database errors
  if (error instanceof SequelizeDatabaseError) {
    const originalError = error.original;
    
    // Lock wait timeout
    if (originalError?.code === 'ER_LOCK_WAIT_TIMEOUT' || originalError?.errno === 1205) {
      return res.status(503).json({
        error: 'Service temporarily unavailable',
        message: 'The system is experiencing high load. Please try again in a moment.',
        code: 'LOCK_TIMEOUT',
        retryAfter: 5000
      });
    }
    
    // Deadlock
    if (originalError?.code === 'ER_LOCK_DEADLOCK' || originalError?.errno === 1213) {
      return res.status(503).json({
        error: 'Service temporarily unavailable',
        message: 'A temporary conflict occurred. Please try again.',
        code: 'DEADLOCK',
        retryAfter: 3000
      });
    }
    
    // Connection errors
    if (originalError?.code === 'ECONNREFUSED' || originalError?.code === 'ETIMEDOUT') {
      return res.status(503).json({
        error: 'Database connection error',
        message: 'Unable to connect to the database. Please try again later.',
        code: 'CONNECTION_ERROR'
      });
    }
    
    // Duplicate entry
    if (originalError?.code === 'ER_DUP_ENTRY' || originalError?.errno === 1062) {
      return res.status(409).json({
        error: 'Duplicate entry',
        message: 'This record already exists.',
        code: 'DUPLICATE_ENTRY'
      });
    }
    
    // Foreign key constraint
    if (originalError?.code === 'ER_NO_REFERENCED_ROW_2' || originalError?.errno === 1452) {
      return res.status(400).json({
        error: 'Invalid reference',
        message: 'Referenced record does not exist.',
        code: 'FOREIGN_KEY_ERROR'
      });
    }
  }
  
  // Handle connection errors
  if (error instanceof SequelizeConnectionError) {
    return res.status(503).json({
      error: 'Database connection error',
      message: 'Unable to connect to the database. Please try again later.',
      code: 'CONNECTION_ERROR'
    });
  }
  
  // Pass to next error handler if not a database error
  next(error);
};

/**
 * Async wrapper to catch database errors in route handlers
 */
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch((error) => {
      // Check if it's a database error
      if (error instanceof SequelizeDatabaseError || error instanceof SequelizeConnectionError) {
        handleDatabaseErrors(error, req, res, next);
      } else {
        next(error);
      }
    });
  };
};

module.exports = {
  handleDatabaseErrors,
  asyncHandler
};