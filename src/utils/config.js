/**
 * Configuration utilities
 */

/**
 * Get the primary frontend URL (first URL from comma-separated list)
 * @returns {string} Primary frontend URL
 */
const getPrimaryFrontendUrl = () => {
  if (!process.env.FRONTEND_URL) {
    return 'http://localhost:5173';
  }
  
  // Return first URL from comma-separated list
  return process.env.FRONTEND_URL.split(',')[0].trim();
};

/**
 * Get all allowed frontend origins for CORS
 * @returns {string[]} Array of allowed origins
 */
const getAllowedOrigins = () => {
  return process.env.FRONTEND_URL
    ? process.env.FRONTEND_URL.split(',').map(url => url.trim())
    : ["http://localhost:5173"];
};

module.exports = {
  getPrimaryFrontendUrl,
  getAllowedOrigins
};