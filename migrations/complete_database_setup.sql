-- ============================================================
-- HomeCare System - Complete Database Setup (CORRECTED)
-- Date: 2026-01-18
-- Purpose: Create all tables needed for the HomeCare System
-- Import this file into phpMyAdmin to set up the database
-- Total Tables: 25
-- ============================================================

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
SET AUTOCOMMIT = 0;
START TRANSACTION;
SET time_zone = "+00:00";

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

-- ============================================================
-- 1. ROLES TABLE (No dependencies)
-- ============================================================
CREATE TABLE IF NOT EXISTS `roles` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(255) NOT NULL,
  `description` TEXT DEFAULT NULL,
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 2. PERMISSIONS TABLE (No dependencies)
-- ============================================================
CREATE TABLE IF NOT EXISTS `permissions` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(255) NOT NULL,
  `description` TEXT DEFAULT NULL,
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 3. ROLE_PERMISSIONS TABLE (Depends on: roles, permissions)
-- ============================================================
CREATE TABLE IF NOT EXISTS `role_permissions` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `role_id` INT(11) NOT NULL,
  `permission_id` INT(11) NOT NULL,
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `role_permission_unique` (`role_id`, `permission_id`),
  KEY `permission_id` (`permission_id`),
  CONSTRAINT `role_permissions_role_fk` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `role_permissions_permission_fk` FOREIGN KEY (`permission_id`) REFERENCES `permissions` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 4. USERS TABLE (Depends on: roles)
-- ============================================================
CREATE TABLE IF NOT EXISTS `users` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `email` VARCHAR(255) NOT NULL,
  `password` VARCHAR(255) NOT NULL,
  `firstName` VARCHAR(255) NOT NULL,
  `lastName` VARCHAR(255) NOT NULL,
  `phone` VARCHAR(255) NOT NULL,
  `idNumber` VARCHAR(255) DEFAULT NULL,
  `role_id` INT(11) NOT NULL,
  `isActive` TINYINT(1) DEFAULT 1,
  `resetPasswordToken` VARCHAR(255) DEFAULT NULL,
  `resetPasswordExpires` DATETIME DEFAULT NULL,
  `assignedRegion` VARCHAR(255) DEFAULT NULL,
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`),
  UNIQUE KEY `idNumber` (`idNumber`),
  KEY `role_id` (`role_id`),
  CONSTRAINT `users_role_fk` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 5. SPECIALTIES TABLE (No dependencies)
-- ============================================================
CREATE TABLE IF NOT EXISTS `specialties` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(255) NOT NULL,
  `description` TEXT DEFAULT NULL,
  `session_fee` DECIMAL(10,2) DEFAULT 0 COMMENT 'Fee charged per session for this specialty',
  `booking_fee` DECIMAL(10,2) DEFAULT 0 COMMENT 'Booking fee charged for this specialty',
  `isActive` TINYINT(1) DEFAULT 1,
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 6. LOCATIONS TABLE (No dependencies)
-- ============================================================
CREATE TABLE IF NOT EXISTS `locations` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `region` VARCHAR(255) NOT NULL,
  `district` VARCHAR(255) NOT NULL,
  `traditional_authority` VARCHAR(255) NOT NULL,
  `village` VARCHAR(255) NOT NULL,
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_region` (`region`),
  KEY `idx_district` (`district`),
  KEY `idx_traditional_authority` (`traditional_authority`),
  KEY `idx_region_district` (`region`, `district`),
  KEY `idx_district_ta` (`district`, `traditional_authority`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 7. USER SETTINGS TABLE (Depends on: users)
-- ============================================================
CREATE TABLE IF NOT EXISTS `user_settings` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `userId` INT(11) NOT NULL,
  `notifications` LONGTEXT DEFAULT NULL COMMENT 'JSON: email, sms, push, appointments, reminders, marketing settings',
  `privacy` LONGTEXT DEFAULT NULL COMMENT 'JSON: profileVisibility, dataSharing, analytics settings',
  `preferences` LONGTEXT DEFAULT NULL COMMENT 'JSON: language, timezone, theme, soundEnabled settings',
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `userId` (`userId`),
  CONSTRAINT `user_settings_user_fk` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 8. PATIENTS TABLE (Depends on: users)
-- ============================================================
CREATE TABLE IF NOT EXISTS `patients` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `userId` INT(11) NOT NULL,
  `dateOfBirth` DATETIME NOT NULL,
  `address` TEXT NOT NULL,
  `emergencyContact` VARCHAR(255) NOT NULL,
  `medicalHistory` TEXT DEFAULT NULL,
  `currentMedications` TEXT DEFAULT NULL,
  `allergies` TEXT DEFAULT NULL,
  `region` VARCHAR(255) DEFAULT NULL,
  `district` VARCHAR(255) DEFAULT NULL,
  `traditional_authority` VARCHAR(255) DEFAULT NULL,
  `village` VARCHAR(255) DEFAULT NULL,
  `patientType` ENUM('adult', 'child', 'elderly') NOT NULL DEFAULT 'adult',
  `guardianFirstName` VARCHAR(255) DEFAULT NULL,
  `guardianLastName` VARCHAR(255) DEFAULT NULL,
  `guardianPhone` VARCHAR(255) DEFAULT NULL,
  `guardianEmail` VARCHAR(255) DEFAULT NULL,
  `guardianRelationship` VARCHAR(255) DEFAULT NULL,
  `guardianIdNumber` VARCHAR(255) DEFAULT NULL,
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `userId` (`userId`),
  CONSTRAINT `patients_user_fk` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 9. CAREGIVERS TABLE (Depends on: users)
-- ============================================================
CREATE TABLE IF NOT EXISTS `caregivers` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `userId` INT(11) NOT NULL,
  `licensingInstitution` VARCHAR(255) DEFAULT NULL,
  `licenseNumber` VARCHAR(255) NOT NULL,
  `experience` INT(11) NOT NULL COMMENT 'Years of experience',
  `qualifications` TEXT NOT NULL,
  `verificationStatus` ENUM('pending', 'verified', 'rejected') DEFAULT 'pending',
  `hourlyRate` DECIMAL(10,2) NOT NULL,
  `availability` JSON DEFAULT NULL,
  `bio` TEXT DEFAULT NULL,
  `profileImage` VARCHAR(255) DEFAULT NULL,
  `supportingDocuments` JSON DEFAULT NULL,
  `idDocuments` JSON DEFAULT NULL COMMENT 'ID documents uploaded during registration',
  `appointmentDuration` INT(11) DEFAULT 180 COMMENT 'Default appointment duration in minutes',
  `autoConfirm` TINYINT(1) DEFAULT 1 COMMENT 'Auto-confirm appointments after payment',
  `region` VARCHAR(255) DEFAULT NULL,
  `district` VARCHAR(255) DEFAULT NULL,
  `traditional_authority` VARCHAR(255) DEFAULT NULL,
  `village` VARCHAR(255) DEFAULT NULL,
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `licenseNumber` (`licenseNumber`),
  KEY `userId` (`userId`),
  CONSTRAINT `caregivers_user_fk` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 10. PRIMARY PHYSICIANS TABLE (Depends on: users)
-- ============================================================
CREATE TABLE IF NOT EXISTS `primaryphysicians` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `userId` INT(11) NOT NULL,
  `medicalLicenseNumber` VARCHAR(255) NOT NULL,
  `specialization` VARCHAR(255) NOT NULL,
  `hospitalAffiliation` VARCHAR(255) DEFAULT NULL,
  `verificationStatus` ENUM('pending', 'verified', 'rejected') DEFAULT 'pending',
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `medicalLicenseNumber` (`medicalLicenseNumber`),
  KEY `userId` (`userId`),
  CONSTRAINT `primaryphysicians_user_fk` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 11. CAREGIVER SPECIALTIES TABLE (Depends on: caregivers, specialties)
-- ============================================================
CREATE TABLE IF NOT EXISTS `caregiverspecialties` (
  `CaregiverId` INT(11) NOT NULL,
  `SpecialtyId` INT(11) NOT NULL,
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`CaregiverId`, `SpecialtyId`),
  KEY `SpecialtyId` (`SpecialtyId`),
  CONSTRAINT `caregiverspecialties_caregiver_fk` FOREIGN KEY (`CaregiverId`) REFERENCES `caregivers` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `caregiverspecialties_specialty_fk` FOREIGN KEY (`SpecialtyId`) REFERENCES `specialties` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 12. CAREGIVER AVAILABILITY TABLE (Depends on: caregivers)
-- ============================================================
CREATE TABLE IF NOT EXISTS `caregiver_availability` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `caregiverId` INT(11) NOT NULL,
  `dayOfWeek` INT(11) NOT NULL COMMENT '0=Sunday, 1=Monday, ..., 6=Saturday',
  `startTime` TIME NOT NULL,
  `endTime` TIME NOT NULL,
  `isActive` TINYINT(1) DEFAULT 1,
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `caregiverId` (`caregiverId`),
  CONSTRAINT `caregiver_availability_fk` FOREIGN KEY (`caregiverId`) REFERENCES `caregivers` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 13. APPOINTMENTS TABLE (Depends on: patients, caregivers, specialties)
-- ============================================================
CREATE TABLE IF NOT EXISTS `appointments` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `patientId` INT(11) NOT NULL,
  `caregiverId` INT(11) NOT NULL,
  `specialtyId` INT(11) NOT NULL,
  `scheduledDate` DATETIME NOT NULL,
  `duration` INT(11) NOT NULL COMMENT 'Duration in minutes',
  `sessionType` ENUM('in_person', 'teleconference') NOT NULL,
  `status` ENUM('pending', 'session_waiting', 'session_attended', 'session_cancelled', 'session_rescheduled') DEFAULT 'pending',
  `notes` TEXT DEFAULT NULL,
  `bookingFee` DECIMAL(10,2) NOT NULL COMMENT 'Booking fee amount for this appointment',
  `sessionFee` DECIMAL(10,2) NOT NULL COMMENT 'Session fee amount for this appointment',
  `totalCost` DECIMAL(10,2) DEFAULT NULL,
  `timeSlotId` INT(11) DEFAULT NULL,
  `booking_fee_status` ENUM('pending', 'completed', 'failed', 'refunded') DEFAULT 'pending' COMMENT 'Payment status for booking fee',
  `session_fee_status` ENUM('pending', 'completed', 'failed', 'refunded') DEFAULT 'pending' COMMENT 'Payment status for session fee',
  `paymentStatus` ENUM('pending', 'completed', 'failed', 'refunded') DEFAULT 'pending' COMMENT 'Overall payment status (deprecated)',
  `bookedAt` DATETIME DEFAULT NULL,
  `session_paid_at` DATETIME DEFAULT NULL COMMENT 'Timestamp when session fee was paid',
  `patient_feedback` TEXT DEFAULT NULL COMMENT 'Patient feedback/comment for this session',
  `patient_rating` INT(11) DEFAULT NULL COMMENT 'Patient rating for this session (1-5 stars)',
  `reschedule_count` INT(11) DEFAULT 0 COMMENT 'Number of times this appointment has been rescheduled',
  `last_rescheduled_at` DATETIME DEFAULT NULL COMMENT 'Timestamp of last reschedule',
  `reschedule_history` JSON DEFAULT NULL COMMENT 'History of reschedules with timestamps and reasons',
  `cancellation_reason` TEXT DEFAULT NULL COMMENT 'Reason for appointment cancellation',
  `cancelled_at` DATETIME DEFAULT NULL COMMENT 'Timestamp when appointment was cancelled',
  `cancelled_by` ENUM('patient', 'system') DEFAULT NULL COMMENT 'Who cancelled the appointment',
  `jitsi_room_name` VARCHAR(255) DEFAULT NULL COMMENT 'Jitsi meeting room name for teleconference',
  `jitsi_meeting_url` VARCHAR(500) DEFAULT NULL COMMENT 'Full Jitsi meeting URL for teleconference',
  `patient_meeting_token` VARCHAR(64) DEFAULT NULL COMMENT 'Unique token for patient to join meeting',
  `caregiver_meeting_token` VARCHAR(64) DEFAULT NULL COMMENT 'Unique token for caregiver to join meeting',
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `patientId` (`patientId`),
  KEY `caregiverId` (`caregiverId`),
  KEY `specialtyId` (`specialtyId`),
  KEY `timeSlotId` (`timeSlotId`),
  KEY `idx_scheduled_date` (`scheduledDate`),
  KEY `idx_status` (`status`),
  CONSTRAINT `appointments_patient_fk` FOREIGN KEY (`patientId`) REFERENCES `patients` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `appointments_caregiver_fk` FOREIGN KEY (`caregiverId`) REFERENCES `caregivers` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `appointments_specialty_fk` FOREIGN KEY (`specialtyId`) REFERENCES `specialties` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 14. TIME SLOTS TABLE (Depends on: caregivers, appointments)
-- ============================================================
CREATE TABLE IF NOT EXISTS `time_slots` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `caregiverId` INT(11) NOT NULL,
  `date` DATE NOT NULL,
  `startTime` TIME NOT NULL,
  `endTime` TIME NOT NULL,
  `duration` INT(11) NOT NULL DEFAULT 180 COMMENT 'Duration in minutes (default 3 hours)',
  `price` DECIMAL(10,2) DEFAULT NULL COMMENT 'Deprecated - prices are now on specialties',
  `status` ENUM('available', 'locked', 'booked') DEFAULT 'available',
  `lockedUntil` DATETIME DEFAULT NULL COMMENT 'Slot locked until this time for payment processing',
  `isBooked` TINYINT(1) DEFAULT 0,
  `appointmentId` INT(11) DEFAULT NULL,
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `caregiver_date_time` (`caregiverId`, `date`, `startTime`),
  KEY `appointmentId` (`appointmentId`),
  CONSTRAINT `time_slots_caregiver_fk` FOREIGN KEY (`caregiverId`) REFERENCES `caregivers` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `time_slots_appointment_fk` FOREIGN KEY (`appointmentId`) REFERENCES `appointments` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Add foreign key for appointments.timeSlotId after time_slots is created
-- This uses a procedure to safely add the constraint only if it doesn't exist
DROP PROCEDURE IF EXISTS AddAppointmentTimeslotFK;
DELIMITER //
CREATE PROCEDURE AddAppointmentTimeslotFK()
BEGIN
    -- Check if constraint already exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
        WHERE CONSTRAINT_NAME = 'appointments_timeslot_fk'
        AND TABLE_NAME = 'appointments'
        AND TABLE_SCHEMA = DATABASE()
    ) THEN
        -- Check if column exists
        IF EXISTS (
            SELECT 1 FROM information_schema.COLUMNS
            WHERE TABLE_NAME = 'appointments'
            AND COLUMN_NAME = 'timeSlotId'
            AND TABLE_SCHEMA = DATABASE()
        ) THEN
            ALTER TABLE `appointments`
                ADD CONSTRAINT `appointments_timeslot_fk`
                FOREIGN KEY (`timeSlotId`) REFERENCES `time_slots` (`id`)
                ON DELETE SET NULL ON UPDATE CASCADE;
        END IF;
    END IF;
END //
DELIMITER ;
CALL AddAppointmentTimeslotFK();
DROP PROCEDURE IF EXISTS AddAppointmentTimeslotFK;

-- ============================================================
-- 15. CAREGIVER RECOMMENDATIONS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS `caregiverrecommendations` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `physicianId` INT(11) NOT NULL,
  `patientId` INT(11) NOT NULL,
  `caregiverId` INT(11) NOT NULL,
  `specialtyId` INT(11) NOT NULL,
  `reason` TEXT NOT NULL,
  `isAccepted` TINYINT(1) DEFAULT NULL,
  `acceptedAt` DATETIME DEFAULT NULL,
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `physicianId` (`physicianId`),
  KEY `patientId` (`patientId`),
  KEY `caregiverId` (`caregiverId`),
  KEY `specialtyId` (`specialtyId`),
  CONSTRAINT `recommendations_physician_fk` FOREIGN KEY (`physicianId`) REFERENCES `primaryphysicians` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `recommendations_patient_fk` FOREIGN KEY (`patientId`) REFERENCES `patients` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `recommendations_caregiver_fk` FOREIGN KEY (`caregiverId`) REFERENCES `caregivers` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `recommendations_specialty_fk` FOREIGN KEY (`specialtyId`) REFERENCES `specialties` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 16. PENDING BOOKINGS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS `pending_bookings` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `timeSlotId` INT(11) NOT NULL,
  `patientId` INT(11) NOT NULL,
  `caregiverId` INT(11) NOT NULL,
  `specialtyId` INT(11) NOT NULL,
  `locationId` INT(11) DEFAULT NULL,
  `sessionType` ENUM('in_person', 'teleconference') NOT NULL DEFAULT 'in_person',
  `notes` TEXT DEFAULT NULL,
  `tx_ref` VARCHAR(255) DEFAULT NULL COMMENT 'Payment transaction reference',
  `bookingFee` DECIMAL(10,2) NOT NULL,
  `sessionFee` DECIMAL(10,2) NOT NULL,
  `totalAmount` DECIMAL(10,2) NOT NULL,
  `status` ENUM('pending', 'payment_initiated', 'payment_completed', 'payment_failed', 'expired', 'converted') DEFAULT 'pending',
  `expiresAt` DATETIME NOT NULL COMMENT 'When this pending booking expires',
  `convertedToAppointmentId` INT(11) DEFAULT NULL,
  `notificationSent` TINYINT(1) DEFAULT 0,
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `tx_ref` (`tx_ref`),
  KEY `idx_status_expires` (`status`, `expiresAt`),
  KEY `timeSlotId` (`timeSlotId`),
  KEY `patientId` (`patientId`),
  KEY `caregiverId` (`caregiverId`),
  KEY `specialtyId` (`specialtyId`),
  KEY `locationId` (`locationId`),
  KEY `convertedToAppointmentId` (`convertedToAppointmentId`),
  CONSTRAINT `pending_bookings_timeslot_fk` FOREIGN KEY (`timeSlotId`) REFERENCES `time_slots` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `pending_bookings_patient_fk` FOREIGN KEY (`patientId`) REFERENCES `patients` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `pending_bookings_caregiver_fk` FOREIGN KEY (`caregiverId`) REFERENCES `caregivers` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `pending_bookings_specialty_fk` FOREIGN KEY (`specialtyId`) REFERENCES `specialties` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `pending_bookings_location_fk` FOREIGN KEY (`locationId`) REFERENCES `locations` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `pending_bookings_appointment_fk` FOREIGN KEY (`convertedToAppointmentId`) REFERENCES `appointments` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 17. PAYMENT TRANSACTIONS TABLE (Depends on: appointments)
-- ============================================================
CREATE TABLE IF NOT EXISTS `paymenttransactions` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `appointmentId` INT(11) NOT NULL,
  `amount` DECIMAL(10,2) NOT NULL COMMENT 'Total amount paid',
  `baseFee` DECIMAL(10,2) DEFAULT NULL COMMENT 'Base fee before tax and convenience fee',
  `taxRate` DECIMAL(5,2) DEFAULT NULL COMMENT 'Tax rate percentage used',
  `taxAmount` DECIMAL(10,2) DEFAULT NULL COMMENT 'Tax amount charged',
  `convenienceFeeRate` DECIMAL(5,2) DEFAULT NULL COMMENT 'Convenience fee rate percentage',
  `convenienceFeeAmount` DECIMAL(10,2) DEFAULT NULL COMMENT 'Convenience fee amount',
  `platformCommissionRate` DECIMAL(5,2) DEFAULT NULL COMMENT 'Platform commission rate percentage',
  `platformCommissionAmount` DECIMAL(10,2) DEFAULT NULL COMMENT 'Platform commission amount',
  `caregiverEarnings` DECIMAL(10,2) DEFAULT NULL COMMENT 'Amount payable to caregiver',
  `payment_type` ENUM('booking_fee', 'session_fee') NOT NULL DEFAULT 'booking_fee' COMMENT 'Type of payment',
  `currency` VARCHAR(10) DEFAULT 'MWK',
  `paymentMethod` VARCHAR(255) NOT NULL,
  `stripePaymentIntentId` VARCHAR(255) DEFAULT NULL,
  `status` ENUM('pending', 'completed', 'failed', 'refunded') DEFAULT 'pending',
  `paidAt` DATETIME DEFAULT NULL,
  `refundedAt` DATETIME DEFAULT NULL,
  `metadata` JSON DEFAULT NULL COMMENT 'Additional payment metadata',
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `appointmentId` (`appointmentId`),
  KEY `idx_status` (`status`),
  KEY `idx_paid_at` (`paidAt`),
  KEY `idx_payment_type` (`payment_type`),
  CONSTRAINT `payments_appointment_fk` FOREIGN KEY (`appointmentId`) REFERENCES `appointments` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 18. PENDING PAYMENT TRANSACTIONS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS `pending_payment_transactions` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `pendingBookingId` INT(11) DEFAULT NULL,
  `appointmentId` INT(11) DEFAULT NULL,
  `amount` DECIMAL(10,2) NOT NULL,
  `paymentType` ENUM('booking_fee', 'session_fee') NOT NULL DEFAULT 'booking_fee',
  `currency` VARCHAR(10) DEFAULT 'MWK',
  `paymentMethod` VARCHAR(255) NOT NULL DEFAULT 'paychangu',
  `tx_ref` VARCHAR(255) NOT NULL,
  `status` ENUM('pending', 'completed', 'failed', 'refunded') DEFAULT 'pending',
  `paidAt` DATETIME DEFAULT NULL,
  `metadata` JSON DEFAULT NULL,
  `convertedToPaymentId` INT(11) DEFAULT NULL,
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `tx_ref` (`tx_ref`),
  KEY `pendingBookingId` (`pendingBookingId`),
  KEY `appointmentId` (`appointmentId`),
  CONSTRAINT `pending_payments_booking_fk` FOREIGN KEY (`pendingBookingId`) REFERENCES `pending_bookings` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `pending_payments_appointment_fk` FOREIGN KEY (`appointmentId`) REFERENCES `appointments` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 19. TELECONFERENCE SESSIONS TABLE (Depends on: appointments)
-- ============================================================
CREATE TABLE IF NOT EXISTS `teleconferencesessions` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `appointmentId` INT(11) NOT NULL,
  `roomId` VARCHAR(255) NOT NULL,
  `startTime` DATETIME DEFAULT NULL,
  `endTime` DATETIME DEFAULT NULL,
  `recordingUrl` VARCHAR(500) DEFAULT NULL,
  `transcription` TEXT DEFAULT NULL,
  `chatHistory` JSON DEFAULT NULL,
  `session_status` VARCHAR(50) DEFAULT 'scheduled' COMMENT 'scheduled, active, completed, cancelled, failed',
  `total_duration_seconds` INT(11) DEFAULT NULL,
  `participant_count` INT(11) DEFAULT 0,
  `peak_participants` INT(11) DEFAULT 0,
  `connection_quality` VARCHAR(20) DEFAULT NULL,
  `total_disconnections` INT(11) DEFAULT 0,
  `recording_status` VARCHAR(50) DEFAULT NULL,
  `recording_duration_seconds` INT(11) DEFAULT NULL,
  `jitsi_room_name` VARCHAR(255) DEFAULT NULL,
  `session_notes` TEXT DEFAULT NULL,
  `metadata` JSON DEFAULT NULL,
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `roomId` (`roomId`),
  KEY `appointmentId` (`appointmentId`),
  KEY `idx_session_status` (`session_status`),
  KEY `idx_start_time` (`startTime`),
  CONSTRAINT `teleconference_appointment_fk` FOREIGN KEY (`appointmentId`) REFERENCES `appointments` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 20. CARE SESSION REPORTS TABLE (Depends on: appointments)
-- ============================================================
CREATE TABLE IF NOT EXISTS `caresessionreports` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `appointmentId` INT(11) NOT NULL,
  `observations` TEXT DEFAULT NULL COMMENT 'Caregiver observations during the session',
  `interventions` TEXT DEFAULT NULL COMMENT 'Interventions performed during the session',
  `vitals` JSON DEFAULT NULL COMMENT 'Patient vitals JSON',
  `patientStatus` ENUM('stable', 'improving', 'deteriorating', 'critical', 'cured', 'deceased') DEFAULT NULL,
  `sessionSummary` TEXT DEFAULT NULL COMMENT 'General summary of the care session',
  `recommendations` TEXT DEFAULT NULL COMMENT 'Recommendations for patient care',
  `followUpRequired` TINYINT(1) DEFAULT 0,
  `follow_up_date` DATETIME DEFAULT NULL COMMENT 'Recommended follow-up date if required',
  `attachments` JSON DEFAULT NULL COMMENT 'Array of uploaded documents/files',
  `medications` TEXT DEFAULT NULL COMMENT 'Medications prescribed or administered',
  `activities` TEXT DEFAULT NULL COMMENT 'Activities performed with patient',
  `notes` TEXT DEFAULT NULL COMMENT 'Additional notes from caregiver',
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `appointmentId` (`appointmentId`),
  CONSTRAINT `reports_appointment_fk` FOREIGN KEY (`appointmentId`) REFERENCES `appointments` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 21. STATUS ALERTS TABLE (Depends on: patients, caresessionreports)
-- ============================================================
CREATE TABLE IF NOT EXISTS `statusalerts` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `patientId` INT(11) NOT NULL,
  `reportId` INT(11) NOT NULL,
  `severity` ENUM('low', 'medium', 'high', 'critical') NOT NULL,
  `message` TEXT NOT NULL,
  `isRead` TINYINT(1) DEFAULT 0,
  `readAt` DATETIME DEFAULT NULL,
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `patientId` (`patientId`),
  KEY `reportId` (`reportId`),
  KEY `idx_severity` (`severity`),
  KEY `idx_is_read` (`isRead`),
  CONSTRAINT `alerts_patient_fk` FOREIGN KEY (`patientId`) REFERENCES `patients` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `alerts_report_fk` FOREIGN KEY (`reportId`) REFERENCES `caresessionreports` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 22. MEETING SETTINGS TABLE (No dependencies)
-- ============================================================
CREATE TABLE IF NOT EXISTS `meeting_settings` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `default_duration` INT(11) DEFAULT 60,
  `allow_early_join_minutes` INT(11) DEFAULT 15,
  `max_late_join_minutes` INT(11) DEFAULT 30,
  `max_meeting_duration` INT(11) DEFAULT 180,
  `auto_end_after_minutes` INT(11) DEFAULT 30,
  `record_meetings` TINYINT(1) DEFAULT 0,
  `require_moderator` TINYINT(1) DEFAULT 1,
  `enable_chat` TINYINT(1) DEFAULT 1,
  `enable_screen_share` TINYINT(1) DEFAULT 1,
  `enable_recording` TINYINT(1) DEFAULT 1,
  `enable_file_sharing` TINYINT(1) DEFAULT 0,
  `enable_virtual_background` TINYINT(1) DEFAULT 1,
  `video_quality` VARCHAR(20) DEFAULT 'high',
  `max_participants` INT(11) DEFAULT 2,
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 23. TELECONFERENCE PARTICIPANT SESSIONS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS `teleconference_participant_sessions` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `teleconference_session_id` INT(11) NOT NULL,
  `appointment_id` INT(11) NOT NULL,
  `participant_id` INT(11) NOT NULL,
  `participant_role` ENUM('patient', 'caregiver') NOT NULL,
  `participant_name` VARCHAR(255) NOT NULL,
  `user_id` INT(11) DEFAULT NULL,
  `joined_at` DATETIME DEFAULT NULL,
  `left_at` DATETIME DEFAULT NULL,
  `session_duration_seconds` INT(11) DEFAULT NULL,
  `join_count` INT(11) DEFAULT 1,
  `disconnection_count` INT(11) DEFAULT 0,
  `connection_quality` VARCHAR(20) DEFAULT NULL,
  `avg_bandwidth_kbps` INT(11) DEFAULT NULL,
  `device_type` VARCHAR(50) DEFAULT NULL,
  `browser` VARCHAR(100) DEFAULT NULL,
  `operating_system` VARCHAR(100) DEFAULT NULL,
  `ip_address` VARCHAR(45) DEFAULT NULL,
  `camera_enabled` TINYINT(1) DEFAULT 1,
  `microphone_enabled` TINYINT(1) DEFAULT 1,
  `screen_shared` TINYINT(1) DEFAULT 0,
  `spoke_time_seconds` INT(11) DEFAULT 0,
  `messages_sent` INT(11) DEFAULT 0,
  `reactions_sent` INT(11) DEFAULT 0,
  `issues_encountered` JSON DEFAULT NULL,
  `error_logs` TEXT DEFAULT NULL,
  `is_moderator` TINYINT(1) DEFAULT 0,
  `session_status` VARCHAR(50) DEFAULT 'active',
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `teleconference_session_id` (`teleconference_session_id`),
  KEY `appointment_id` (`appointment_id`),
  KEY `idx_participant` (`participant_id`, `participant_role`),
  CONSTRAINT `participant_session_fk` FOREIGN KEY (`teleconference_session_id`) REFERENCES `teleconferencesessions` (`id`) ON DELETE CASCADE,
  CONSTRAINT `participant_appointment_fk` FOREIGN KEY (`appointment_id`) REFERENCES `appointments` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 24. TELECONFERENCE EVENTS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS `teleconference_events` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `teleconference_session_id` INT(11) NOT NULL,
  `participant_session_id` INT(11) DEFAULT NULL,
  `event_type` VARCHAR(50) NOT NULL,
  `event_data` JSON DEFAULT NULL,
  `timestamp` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `teleconference_session_id` (`teleconference_session_id`),
  KEY `participant_session_id` (`participant_session_id`),
  KEY `idx_event_type` (`event_type`),
  KEY `idx_timestamp` (`timestamp`),
  CONSTRAINT `event_session_fk` FOREIGN KEY (`teleconference_session_id`) REFERENCES `teleconferencesessions` (`id`) ON DELETE CASCADE,
  CONSTRAINT `event_participant_fk` FOREIGN KEY (`participant_session_id`) REFERENCES `teleconference_participant_sessions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 25. EMAIL QUEUE TABLE (No dependencies)
-- ============================================================
CREATE TABLE IF NOT EXISTS `email_queues` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `to` VARCHAR(255) NOT NULL,
  `subject` VARCHAR(255) NOT NULL,
  `template` VARCHAR(255) NOT NULL,
  `data` JSON NOT NULL,
  `status` ENUM('pending', 'sent', 'failed') DEFAULT 'pending',
  `attempts` INT(11) DEFAULT 0,
  `error` TEXT DEFAULT NULL,
  `scheduledAt` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `sentAt` DATETIME DEFAULT NULL,
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_status` (`status`),
  KEY `idx_scheduled_at` (`scheduledAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- INSERT DEFAULT DATA
-- ============================================================

-- Insert default roles
INSERT INTO `roles` (`name`, `description`) VALUES
('patient', 'Patient user role'),
('caregiver', 'Caregiver user role'),
('primary_physician', 'Primary physician user role'),
('system_manager', 'System manager with full access'),
('regional_manager', 'Regional manager with limited admin access')
ON DUPLICATE KEY UPDATE id=id;

-- Insert default permissions
INSERT INTO `permissions` (`name`, `description`) VALUES
('view_patients', 'View patient information'),
('manage_patients', 'Create, update, delete patients'),
('view_caregivers', 'View caregiver information'),
('manage_caregivers', 'Create, update, delete caregivers'),
('view_appointments', 'View appointments'),
('manage_appointments', 'Create, update, delete appointments'),
('view_reports', 'View care session reports'),
('manage_reports', 'Create, update, delete reports'),
('view_payments', 'View payment transactions'),
('manage_payments', 'Process payments and refunds'),
('manage_users', 'Manage all users'),
('system_settings', 'Access system settings')
ON DUPLICATE KEY UPDATE id=id;

-- Insert default meeting settings
INSERT INTO `meeting_settings` (
  `default_duration`,
  `allow_early_join_minutes`,
  `max_late_join_minutes`,
  `max_meeting_duration`,
  `record_meetings`,
  `video_quality`
) VALUES (60, 15, 30, 180, 0, 'high')
ON DUPLICATE KEY UPDATE id=id;

-- ============================================================
-- SUMMARY OF TABLES (25 TOTAL)
-- ============================================================
-- 1.  roles
-- 2.  permissions
-- 3.  role_permissions
-- 4.  users
-- 5.  specialties
-- 6.  locations
-- 7.  user_settings
-- 8.  patients
-- 9.  caregivers
-- 10. primaryphysicians
-- 11. caregiverspecialties
-- 12. caregiver_availability
-- 13. appointments
-- 14. time_slots
-- 15. caregiverrecommendations
-- 16. pending_bookings
-- 17. paymenttransactions
-- 18. pending_payment_transactions
-- 19. teleconferencesessions
-- 20. caresessionreports
-- 21. statusalerts
-- 22. meeting_settings
-- 23. teleconference_participant_sessions
-- 24. teleconference_events
-- 25. email_queues
-- ============================================================

COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
