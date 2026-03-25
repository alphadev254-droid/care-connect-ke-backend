require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const sequelize = require('../config/database');

const run = async () => {
  try {
    // 1. Show all tables
    const [tables] = await sequelize.query('SHOW TABLES');
    const tableNames = tables.map(t => Object.values(t)[0]);
    console.log('Existing tables:', tableNames.join(', '));

    // 2. Show paymenttransactions columns
    const [cols] = await sequelize.query('DESCRIBE paymenttransactions');
    const colNames = cols.map(c => c.Field);
    console.log('\npaymenttransactions columns:', colNames.join(', '));

    // ── paymenttransactions: add new, drop old ──────────────────────────────
    const addCols = [];
    if (!colNames.includes('paystack_reference'))
      addCols.push('ADD COLUMN paystack_reference VARCHAR(255) NULL AFTER paymentMethod');
    if (!colNames.includes('subaccount_code'))
      addCols.push('ADD COLUMN subaccount_code VARCHAR(255) NULL AFTER paystack_reference');
    if (!colNames.includes('transaction_charge'))
      addCols.push('ADD COLUMN transaction_charge DECIMAL(10,2) NULL AFTER subaccount_code');
    if (!colNames.includes('channel'))
      addCols.push('ADD COLUMN channel VARCHAR(100) NULL AFTER transaction_charge');

    const dropCols = [];
    if (colNames.includes('stripePaymentIntentId'))
      dropCols.push('DROP COLUMN stripePaymentIntentId');
    if (colNames.includes('taxRate'))
      dropCols.push('DROP COLUMN taxRate');
    if (colNames.includes('taxAmount'))
      dropCols.push('DROP COLUMN taxAmount');

    if (addCols.length || dropCols.length) {
      const alterSQL = `ALTER TABLE paymenttransactions ${[...addCols, ...dropCols].join(', ')}`;
      console.log('\nAltering paymenttransactions...');
      await sequelize.query(alterSQL);
      console.log('Done.');
    } else {
      console.log('\npaymenttransactions already up to date.');
    }

    // ── pending_payment_transactions ────────────────────────────────────────
    if (!tableNames.includes('pending_payment_transactions')) {
      console.log('\nCreating pending_payment_transactions...');
      await sequelize.query(`
        CREATE TABLE pending_payment_transactions (
          id INT AUTO_INCREMENT PRIMARY KEY,
          pendingBookingId INT NULL,
          appointmentId INT NULL,
          amount DECIMAL(10,2) NOT NULL,
          paymentType ENUM('booking_fee','session_fee') NOT NULL DEFAULT 'booking_fee',
          currency VARCHAR(10) DEFAULT 'KES',
          paymentMethod VARCHAR(100) NOT NULL DEFAULT 'paystack',
          tx_ref VARCHAR(255) NOT NULL UNIQUE,
          status ENUM('pending','completed','failed','refunded') DEFAULT 'pending',
          paidAt DATETIME NULL,
          metadata JSON NULL,
          convertedToPaymentId INT NULL,
          createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
      `);
      console.log('Done.');
    } else {
      console.log('\npending_payment_transactions already exists.');
    }

    // ── caregiver_earnings ──────────────────────────────────────────────────
    if (!tableNames.includes('caregiver_earnings')) {
      console.log('\nCreating caregiver_earnings...');
      await sequelize.query(`
        CREATE TABLE caregiver_earnings (
          id INT AUTO_INCREMENT PRIMARY KEY,
          caregiver_id INT NOT NULL UNIQUE,
          total_caregiver_earnings DECIMAL(10,2) NOT NULL DEFAULT 0.00,
          wallet_balance DECIMAL(10,2) NOT NULL DEFAULT 0.00,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          FOREIGN KEY (caregiver_id) REFERENCES caregivers(id)
        )
      `);
      console.log('Done.');
    } else {
      console.log('\ncaRegiver_earnings already exists.');
    }

    // ── paystack_subaccounts ────────────────────────────────────────────────
    if (!tableNames.includes('paystack_subaccounts')) {
      console.log('\nCreating paystack_subaccounts...');
      await sequelize.query(`
        CREATE TABLE paystack_subaccounts (
          id INT AUTO_INCREMENT PRIMARY KEY,
          caregiver_id INT NOT NULL UNIQUE,
          business_name VARCHAR(255) NOT NULL,
          settlement_bank VARCHAR(100) NOT NULL,
          account_number VARCHAR(100) NOT NULL,
          account_name VARCHAR(255) NULL,
          subaccount_code VARCHAR(100) NULL UNIQUE,
          percentage_charge DECIMAL(5,2) NOT NULL DEFAULT 78.00,
          is_active TINYINT(1) DEFAULT 1,
          paystack_response JSON NULL,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          FOREIGN KEY (caregiver_id) REFERENCES caregivers(id)
        )
      `);
      console.log('Done.');
    } else {
      console.log('\npaystack_subaccounts already exists.');
    }

    // ── settlements ─────────────────────────────────────────────────────────
    if (!tableNames.includes('settlements')) {
      console.log('\nCreating settlements...');
      await sequelize.query(`
        CREATE TABLE settlements (
          id INT AUTO_INCREMENT PRIMARY KEY,
          caregiver_id INT NOT NULL,
          subaccount_code VARCHAR(100) NOT NULL,
          paystack_settlement_id INT NULL UNIQUE,
          amount DECIMAL(12,2) NOT NULL,
          total_fees DECIMAL(12,2) NULL,
          status ENUM('pending','processing','processed','failed') DEFAULT 'pending',
          settled_at DATETIME NULL,
          integration INT NULL,
          metadata JSON NULL,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          FOREIGN KEY (caregiver_id) REFERENCES caregivers(id)
        )
      `);
      console.log('Done.');
    } else {
      console.log('\nsettlements already exists.');
    }

    console.log('\n✅ Migration complete.');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  }
};

run();
