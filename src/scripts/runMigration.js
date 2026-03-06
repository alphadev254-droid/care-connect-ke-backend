require('dotenv').config();
const migrateBookingSystem = require('./migrateBookingSystem');

console.log('🚀 Starting Booking System Database Migration...');
console.log('📊 Database:', process.env.DB_NAME);
console.log('🔗 Host:', process.env.DB_HOST);

migrateBookingSystem();