/**
 * UUID Migration Script
 * Drops all tables and recreates them with UUID primary keys.
 * Run once: node src/scripts/migrateToUuid.js
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const sequelize = require('../config/database');

// Import in dependency order (no FKs first)
const Role = require('../models/Role');
const Permission = require('../models/Permission');
const RolePermission = require('../models/RolePermission');
const User = require('../models/User');
const Patient = require('../models/Patient');
const Caregiver = require('../models/Caregiver');
const Specialty = require('../models/Specialty');
const Location = require('../models/Location');
const CaregiverAvailability = require('../models/CaregiverAvailability');
const TimeSlot = require('../models/TimeSlot');
const Appointment = require('../models/Appointment');
const PaymentTransaction = require('../models/PaymentTransaction');
const PendingBooking = require('../models/PendingBooking');
const PendingPaymentTransaction = require('../models/PendingPaymentTransaction');
const Notification = require('../models/Notification');
const CaregiverEarnings = require('../models/CaregiverEarnings');
const PaystackSubaccount = require('../models/PaystackSubaccount');
const Settlement = require('../models/Settlement');
const TeleconferenceSession = require('../models/TeleconferenceSession');
const UserSettings = require('../models/UserSettings');
const MeetingSettings = require('../models/MeetingSettings');
const Referral = require('../models/Referral');
const PrimaryPhysician = require('../models/PrimaryPhysician');
const CaregiverRecommendation = require('../models/CaregiverRecommendation');
const CareSessionReport = require('../models/CareSessionReport');
const StatusAlert = require('../models/StatusAlert');
const EmailQueue = require('../models/EmailQueue');

// Must load index.js to register all associations
require('../models/index');

async function migrate() {
  try {
    await sequelize.authenticate();
    console.log('✓ DB connected');

    // Drop all tables in reverse FK order
    await sequelize.query('SET FOREIGN_KEY_CHECKS = 0');
    const [tables] = await sequelize.query('SHOW TABLES');
    const tableNames = tables.map(t => Object.values(t)[0]);
    for (const table of tableNames) {
      await sequelize.query(`DROP TABLE IF EXISTS \`${table}\``);
      console.log(`  dropped: ${table}`);
    }
    await sequelize.query('SET FOREIGN_KEY_CHECKS = 1');
    console.log('✓ All tables dropped');

    // Recreate all tables
    await sequelize.sync({ force: false });
    console.log('✓ All tables recreated with UUID keys');


  } catch (err) {
    console.error('✗ Migration failed:', err.message);
    console.error(err);
    process.exit(1);
  }
}

migrate();
