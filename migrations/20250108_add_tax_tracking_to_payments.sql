-- Migration: Add tax and commission tracking to paymenttransactions table
-- Date: 2025-01-08
-- Purpose: Track tax, convenience fees, and platform commission for each transaction

ALTER TABLE paymenttransactions
ADD COLUMN baseFee DECIMAL(10, 2) NULL COMMENT 'Base fee before tax and convenience fee',
ADD COLUMN taxRate DECIMAL(5, 2) NULL COMMENT 'Tax rate percentage used (saved from ENV at transaction time)',
ADD COLUMN taxAmount DECIMAL(10, 2) NULL COMMENT 'Tax amount charged',
ADD COLUMN convenienceFeeRate DECIMAL(5, 2) NULL COMMENT 'Convenience/processing fee rate percentage (saved from ENV)',
ADD COLUMN convenienceFeeAmount DECIMAL(10, 2) NULL COMMENT 'Convenience/processing fee amount',
ADD COLUMN platformCommissionRate DECIMAL(5, 2) NULL COMMENT 'Platform commission rate percentage (saved from ENV)',
ADD COLUMN platformCommissionAmount DECIMAL(10, 2) NULL COMMENT 'Platform commission amount (deducted from base fee)',
ADD COLUMN caregiverEarnings DECIMAL(10, 2) NULL COMMENT 'Amount payable to caregiver (baseFee - platformCommission)',
ADD COLUMN metadata JSON NULL COMMENT 'Additional payment metadata';

-- Add indexes for reporting queries
CREATE INDEX idx_payment_type ON paymenttransactions(payment_type);
CREATE INDEX idx_paid_at ON paymenttransactions(paidAt);
CREATE INDEX idx_status ON paymenttransactions(status);

-- Update existing comment for amount column
ALTER TABLE paymenttransactions
MODIFY COLUMN amount DECIMAL(10, 2) NOT NULL COMMENT 'Total amount paid by patient (base + tax + convenience fee)';
