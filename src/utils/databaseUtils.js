const { sequelize } = require('../models');

/**
 * Execute a database operation with retry logic for lock timeouts
 */
async function executeWithRetry(operation, maxRetries = 3) {
  let attempt = 0;
  
  while (attempt < maxRetries) {
    const transaction = await sequelize.transaction();
    
    try {
      const result = await operation(transaction);
      await transaction.commit();
      return result;
    } catch (error) {
      await transaction.rollback();
      attempt++;
      
      console.error(`Database operation attempt ${attempt} failed:`, error.message);
      
      // Check if it's a retryable error (lock timeout, deadlock, connection issues)
      const isRetryableError = error.name === 'SequelizeDatabaseError' && (
        error.original?.code === 'ER_LOCK_WAIT_TIMEOUT' ||
        error.original?.code === 'ER_LOCK_DEADLOCK' ||
        error.original?.errno === 1205 ||
        error.original?.errno === 1213 ||
        error.message.includes('Lock wait timeout') ||
        error.message.includes('Deadlock found')
      );
      
      if (isRetryableError && attempt < maxRetries) {
        // Wait with exponential backoff before retry
        const delay = Math.pow(2, attempt) * 1000 + Math.random() * 1000;
        console.log(`Retrying database operation in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      // If not retryable or max retries reached, throw the error
      throw error;
    }
  }
}

/**
 * Execute a bulk operation with retry logic
 */
async function executeBulkWithRetry(model, data, options = {}, maxRetries = 3) {
  let attempt = 0;
  
  while (attempt < maxRetries) {
    try {
      const result = await model.bulkCreate(data, {
        ignoreDuplicates: true,
        validate: true,
        ...options
      });
      return result;
    } catch (error) {
      attempt++;
      console.error(`Bulk operation attempt ${attempt} failed:`, error.message);
      
      // Check if it's a retryable error
      const isRetryableError = error.name === 'SequelizeDatabaseError' && (
        error.original?.code === 'ER_LOCK_WAIT_TIMEOUT' ||
        error.original?.code === 'ER_LOCK_DEADLOCK' ||
        error.original?.errno === 1205 ||
        error.original?.errno === 1213
      );
      
      if (isRetryableError && attempt < maxRetries) {
        // Wait with exponential backoff before retry
        const delay = Math.pow(2, attempt) * 1000 + Math.random() * 1000;
        console.log(`Retrying bulk operation in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      throw error;
    }
  }
}

/**
 * Check database connection health
 */
async function checkDatabaseHealth() {
  try {
    await sequelize.authenticate();
    return { healthy: true, message: 'Database connection is healthy' };
  } catch (error) {
    console.error('Database health check failed:', error);
    return { healthy: false, message: error.message };
  }
}

/**
 * Get database connection pool status
 */
function getPoolStatus() {
  const pool = sequelize.connectionManager.pool;
  return {
    size: pool.size,
    available: pool.available,
    using: pool.using,
    waiting: pool.waiting
  };
}

module.exports = {
  executeWithRetry,
  executeBulkWithRetry,
  checkDatabaseHealth,
  getPoolStatus
};