const sequelize = require('../config/database');

async function createPendingPaymentTransactionsTable() {
  try {
    console.log('🔄 Creating pending_payment_transactions table...');

    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS pending_payment_transactions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        pendingBookingId INT NOT NULL,
        amount DECIMAL(10, 2) NOT NULL,
        paymentType ENUM('booking_fee', 'session_fee') NOT NULL DEFAULT 'booking_fee',
        currency VARCHAR(255) DEFAULT 'MWK',
        paymentMethod VARCHAR(255) NOT NULL DEFAULT 'paychangu',
        tx_ref VARCHAR(255) NOT NULL UNIQUE,
        status ENUM('pending', 'completed', 'failed', 'refunded') DEFAULT 'pending',
        paidAt DATETIME NULL,
        metadata JSON NULL,
        convertedToPaymentId INT NULL,
        createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (pendingBookingId) REFERENCES pending_bookings(id) ON DELETE CASCADE,
        FOREIGN KEY (convertedToPaymentId) REFERENCES paymenttransactions(id) ON DELETE SET NULL,
        INDEX idx_tx_ref (tx_ref),
        INDEX idx_pending_booking (pendingBookingId),
        INDEX idx_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    console.log('✅ pending_payment_transactions table created successfully!');
    console.log('   - Stores temporary payment records before appointment creation');
    console.log('   - Links to pending_bookings via pendingBookingId');
    console.log('   - Tracks conversion to actual PaymentTransaction via convertedToPaymentId');
    console.log('   - Includes indexes for optimal query performance');

    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

createPendingPaymentTransactionsTable();
