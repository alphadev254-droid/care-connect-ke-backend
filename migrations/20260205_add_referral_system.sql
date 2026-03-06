-- Migration: Add referral system for caregivers
-- Date: 2026-02-05
-- Purpose: Enable caregivers to refer patients and earn boost score for higher visibility

-- Create referrals table
CREATE TABLE IF NOT EXISTS referrals (
  id INT AUTO_INCREMENT PRIMARY KEY,
  caregiverId INT NOT NULL COMMENT 'The caregiver who created this referral',
  referralCode VARCHAR(10) NOT NULL UNIQUE COMMENT 'Unique referral code (e.g., CARE7X9K2L)',
  patientId INT NULL COMMENT 'The patient who used this referral code (null until conversion)',
  status ENUM('pending', 'converted', 'cancelled') DEFAULT 'pending' COMMENT 'pending: link shared, converted: patient registered, cancelled: patient deleted account',
  convertedAt DATETIME NULL COMMENT 'When the referral converted (patient completed registration)',
  expiresAt DATETIME NULL COMMENT 'Optional expiration date for referral codes',
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (caregiverId) REFERENCES caregivers(id) ON DELETE CASCADE,
  FOREIGN KEY (patientId) REFERENCES patients(id) ON DELETE SET NULL,

  INDEX idx_caregiverId (caregiverId),
  INDEX idx_referralCode (referralCode),
  INDEX idx_status (status),
  INDEX idx_patientId (patientId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Add referral boost fields to caregivers table
ALTER TABLE caregivers
ADD COLUMN referralBoostScore INT DEFAULT 0 COMMENT 'Boost score from successful referrals (1 point per converted referral)',
ADD COLUMN referralCount INT DEFAULT 0 COMMENT 'Total number of converted referrals';

-- Add indexes for sorting/filtering by boost score
CREATE INDEX idx_referralBoostScore ON caregivers(referralBoostScore);
CREATE INDEX idx_referralCount ON caregivers(referralCount);
