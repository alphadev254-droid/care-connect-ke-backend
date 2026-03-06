-- Migration: Update Appointments table for dual payment system (booking fee + session fee)
-- Date: 2025-12-19

-- Add new columns to Appointments table if they don't exist
SET @dbname = DATABASE();
SET @tablename = 'Appointments';

-- Add bookingFee column
SET @col_exists = 0;
SELECT COUNT(*) INTO @col_exists FROM information_schema.columns
WHERE table_schema = @dbname AND table_name = @tablename AND column_name = 'bookingFee';
SET @query = IF(@col_exists = 0,
  'ALTER TABLE `Appointments` ADD COLUMN `bookingFee` DECIMAL(10, 2) NOT NULL DEFAULT 0 COMMENT ''Booking fee amount for this appointment''',
  'SELECT ''Column bookingFee already exists'' AS message');
PREPARE stmt FROM @query;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add sessionFee column
SET @col_exists = 0;
SELECT COUNT(*) INTO @col_exists FROM information_schema.columns
WHERE table_schema = @dbname AND table_name = @tablename AND column_name = 'sessionFee';
SET @query = IF(@col_exists = 0,
  'ALTER TABLE `Appointments` ADD COLUMN `sessionFee` DECIMAL(10, 2) NOT NULL DEFAULT 0 COMMENT ''Session fee amount for this appointment''',
  'SELECT ''Column sessionFee already exists'' AS message');
PREPARE stmt FROM @query;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add booking_fee_status column
SET @col_exists = 0;
SELECT COUNT(*) INTO @col_exists FROM information_schema.columns
WHERE table_schema = @dbname AND table_name = @tablename AND column_name = 'booking_fee_status';
SET @query = IF(@col_exists = 0,
  'ALTER TABLE `Appointments` ADD COLUMN `booking_fee_status` ENUM(''pending'', ''completed'', ''failed'', ''refunded'') DEFAULT ''pending'' COMMENT ''Payment status for booking fee''',
  'SELECT ''Column booking_fee_status already exists'' AS message');
PREPARE stmt FROM @query;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add session_fee_status column
SET @col_exists = 0;
SELECT COUNT(*) INTO @col_exists FROM information_schema.columns
WHERE table_schema = @dbname AND table_name = @tablename AND column_name = 'session_fee_status';
SET @query = IF(@col_exists = 0,
  'ALTER TABLE `Appointments` ADD COLUMN `session_fee_status` ENUM(''pending'', ''completed'', ''failed'', ''refunded'') DEFAULT ''pending'' COMMENT ''Payment status for session fee''',
  'SELECT ''Column session_fee_status already exists'' AS message');
PREPARE stmt FROM @query;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add session_paid_at column
SET @col_exists = 0;
SELECT COUNT(*) INTO @col_exists FROM information_schema.columns
WHERE table_schema = @dbname AND table_name = @tablename AND column_name = 'session_paid_at';
SET @query = IF(@col_exists = 0,
  'ALTER TABLE `Appointments` ADD COLUMN `session_paid_at` DATETIME NULL COMMENT ''Timestamp when session fee was paid''',
  'SELECT ''Column session_paid_at already exists'' AS message');
PREPARE stmt FROM @query;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add patient_feedback column
SET @col_exists = 0;
SELECT COUNT(*) INTO @col_exists FROM information_schema.columns
WHERE table_schema = @dbname AND table_name = @tablename AND column_name = 'patient_feedback';
SET @query = IF(@col_exists = 0,
  'ALTER TABLE `Appointments` ADD COLUMN `patient_feedback` TEXT NULL COMMENT ''Patient feedback/comment for this session (admin-only visibility)''',
  'SELECT ''Column patient_feedback already exists'' AS message');
PREPARE stmt FROM @query;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add patient_rating column
SET @col_exists = 0;
SELECT COUNT(*) INTO @col_exists FROM information_schema.columns
WHERE table_schema = @dbname AND table_name = @tablename AND column_name = 'patient_rating';
SET @query = IF(@col_exists = 0,
  'ALTER TABLE `Appointments` ADD COLUMN `patient_rating` INT NULL COMMENT ''Patient rating for this session (1-5 stars)''',
  'SELECT ''Column patient_rating already exists'' AS message');
PREPARE stmt FROM @query;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add payment_type column to PaymentTransactions table
SET @tablename2 = 'PaymentTransactions';
SET @col_exists = 0;
SELECT COUNT(*) INTO @col_exists FROM information_schema.columns
WHERE table_schema = @dbname AND table_name = @tablename2 AND column_name = 'payment_type';
SET @query = IF(@col_exists = 0,
  'ALTER TABLE `PaymentTransactions` ADD COLUMN `payment_type` ENUM(''booking_fee'', ''session_fee'') NOT NULL DEFAULT ''booking_fee'' COMMENT ''Type of payment: booking_fee or session_fee''',
  'SELECT ''Column payment_type already exists'' AS message');
PREPARE stmt FROM @query;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Update CareSessionReports table only if it exists
SET @table_exists = 0;
SELECT COUNT(*) INTO @table_exists FROM information_schema.tables
WHERE table_schema = @dbname AND table_name = 'CareSessionReports';

-- Make existing fields nullable if table exists
SET @query = IF(@table_exists > 0,
  'ALTER TABLE `CareSessionReports`
   MODIFY COLUMN `observations` TEXT NULL COMMENT ''Caregiver observations during the session'',
   MODIFY COLUMN `interventions` TEXT NULL COMMENT ''Interventions performed during the session'',
   MODIFY COLUMN `patientStatus` ENUM(''stable'', ''improving'', ''deteriorating'', ''critical'', ''cured'', ''deceased'') NULL COMMENT ''Overall patient status assessment'',
   MODIFY COLUMN `sessionSummary` TEXT NULL COMMENT ''General summary of the care session''',
  'SELECT ''CareSessionReports table does not exist, skipping'' AS message');
PREPARE stmt FROM @query;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add new columns to CareSessionReports table if it exists
SET @tablename3 = 'CareSessionReports';

-- Add follow_up_date column
SET @col_exists = 0;
SELECT COUNT(*) INTO @col_exists FROM information_schema.columns
WHERE table_schema = @dbname AND table_name = @tablename3 AND column_name = 'follow_up_date';
SET @query = IF(@col_exists = 0 AND @table_exists > 0,
  'ALTER TABLE `CareSessionReports` ADD COLUMN `follow_up_date` DATETIME NULL COMMENT ''Recommended follow-up date if required''',
  'SELECT ''Column follow_up_date already exists or table missing'' AS message');
PREPARE stmt FROM @query;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add medications column
SET @col_exists = 0;
SELECT COUNT(*) INTO @col_exists FROM information_schema.columns
WHERE table_schema = @dbname AND table_name = @tablename3 AND column_name = 'medications';
SET @query = IF(@col_exists = 0 AND @table_exists > 0,
  'ALTER TABLE `CareSessionReports` ADD COLUMN `medications` TEXT NULL COMMENT ''Medications prescribed or administered''',
  'SELECT ''Column medications already exists or table missing'' AS message');
PREPARE stmt FROM @query;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add activities column
SET @col_exists = 0;
SELECT COUNT(*) INTO @col_exists FROM information_schema.columns
WHERE table_schema = @dbname AND table_name = @tablename3 AND column_name = 'activities';
SET @query = IF(@col_exists = 0 AND @table_exists > 0,
  'ALTER TABLE `CareSessionReports` ADD COLUMN `activities` TEXT NULL COMMENT ''Activities performed with patient (exercises, therapy, etc.)''',
  'SELECT ''Column activities already exists or table missing'' AS message');
PREPARE stmt FROM @query;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add notes column
SET @col_exists = 0;
SELECT COUNT(*) INTO @col_exists FROM information_schema.columns
WHERE table_schema = @dbname AND table_name = @tablename3 AND column_name = 'notes';
SET @query = IF(@col_exists = 0 AND @table_exists > 0,
  'ALTER TABLE `CareSessionReports` ADD COLUMN `notes` TEXT NULL COMMENT ''Additional notes from caregiver''',
  'SELECT ''Column notes already exists or table missing'' AS message');
PREPARE stmt FROM @query;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Update existing appointments to set booking and session fees based on totalCost
-- This is a one-time data migration - adjust the split as needed
UPDATE `Appointments`
SET
  `bookingFee` = COALESCE(`totalCost`, 0) * 0.2,
  `sessionFee` = COALESCE(`totalCost`, 0) * 0.8
WHERE `bookingFee` = 0 AND `sessionFee` = 0;

-- Update existing appointments booking fee status based on current payment status
UPDATE `Appointments`
SET `booking_fee_status` = `paymentStatus`
WHERE `booking_fee_status` = 'pending';

-- Add index for better query performance
CREATE INDEX `idx_appointments_booking_fee_status` ON `Appointments`(`booking_fee_status`);
CREATE INDEX `idx_appointments_session_fee_status` ON `Appointments`(`session_fee_status`);
CREATE INDEX `idx_payment_transactions_payment_type` ON `PaymentTransactions`(`payment_type`);

-- Comments
SELECT 'Migration completed: Appointments table updated for dual payment system' AS message;
