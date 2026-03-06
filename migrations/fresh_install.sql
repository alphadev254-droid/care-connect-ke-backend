-- ============================================================
-- HomeCare System - FRESH DATABASE INSTALL
-- Date: 2026-01-18
-- WARNING: This will DROP ALL EXISTING TABLES and data!
-- Use this only for a completely fresh installation
-- Total Tables: 25
-- ============================================================

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
SET FOREIGN_KEY_CHECKS = 0;
SET AUTOCOMMIT = 0;
START TRANSACTION;
SET time_zone = "+00:00";

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

-- ============================================================
-- DROP ALL EXISTING TABLES (in reverse dependency order)
-- ============================================================
DROP TABLE IF EXISTS `teleconference_events`;
DROP TABLE IF EXISTS `teleconference_participant_sessions`;
DROP TABLE IF EXISTS `meeting_settings`;
DROP TABLE IF EXISTS `EmailQueues`;
DROP TABLE IF EXISTS `statusalerts`;
DROP TABLE IF EXISTS `caresessionreports`;
DROP TABLE IF EXISTS `teleconferencesessions`;
DROP TABLE IF EXISTS `pending_payment_transactions`;
DROP TABLE IF EXISTS `paymenttransactions`;
DROP TABLE IF EXISTS `pending_bookings`;
DROP TABLE IF EXISTS `caregiverrecommendations`;
DROP TABLE IF EXISTS `time_slots`;
DROP TABLE IF EXISTS `appointments`;
DROP TABLE IF EXISTS `caregiver_availability`;
DROP TABLE IF EXISTS `caregiverspecialties`;
DROP TABLE IF EXISTS `caregivers`;
DROP TABLE IF EXISTS `primaryphysicians`;
DROP TABLE IF EXISTS `patients`;
DROP TABLE IF EXISTS `user_settings`;
DROP TABLE IF EXISTS `users`;
DROP TABLE IF EXISTS `role_permissions`;
DROP TABLE IF EXISTS `permissions`;
DROP TABLE IF EXISTS `roles`;
DROP TABLE IF EXISTS `specialties`;
DROP TABLE IF EXISTS `locations`;

-- ============================================================
-- 1. ROLES TABLE
-- ============================================================
CREATE TABLE `roles` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(255) NOT NULL,
  `description` TEXT DEFAULT NULL,
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 2. PERMISSIONS TABLE
-- ============================================================
CREATE TABLE `permissions` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(255) NOT NULL,
  `description` TEXT DEFAULT NULL,
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 3. ROLE_PERMISSIONS TABLE
-- ============================================================
CREATE TABLE `role_permissions` (
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
-- 4. USERS TABLE
-- ============================================================
CREATE TABLE `users` (
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
-- 5. SPECIALTIES TABLE
-- ============================================================
CREATE TABLE `specialties` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(255) NOT NULL,
  `description` TEXT DEFAULT NULL,
  `session_fee` DECIMAL(10,2) DEFAULT 0,
  `booking_fee` DECIMAL(10,2) DEFAULT 0,
  `isActive` TINYINT(1) DEFAULT 1,
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 6. LOCATIONS TABLE
-- ============================================================
CREATE TABLE `locations` (
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
-- 7. USER SETTINGS TABLE
-- ============================================================
CREATE TABLE `user_settings` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `userId` INT(11) NOT NULL,
  `notifications` LONGTEXT DEFAULT NULL,
  `privacy` LONGTEXT DEFAULT NULL,
  `preferences` LONGTEXT DEFAULT NULL,
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `userId` (`userId`),
  CONSTRAINT `user_settings_user_fk` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 8. PATIENTS TABLE
-- ============================================================
CREATE TABLE `patients` (
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
-- 9. CAREGIVERS TABLE
-- ============================================================
CREATE TABLE `caregivers` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `userId` INT(11) NOT NULL,
  `licensingInstitution` VARCHAR(255) DEFAULT NULL,
  `licenseNumber` VARCHAR(255) NOT NULL,
  `experience` INT(11) NOT NULL,
  `qualifications` TEXT NOT NULL,
  `verificationStatus` ENUM('pending', 'verified', 'rejected') DEFAULT 'pending',
  `hourlyRate` DECIMAL(10,2) NOT NULL,
  `availability` JSON DEFAULT NULL,
  `bio` TEXT DEFAULT NULL,
  `profileImage` VARCHAR(255) DEFAULT NULL,
  `supportingDocuments` JSON DEFAULT NULL,
  `idDocuments` JSON DEFAULT NULL,
  `appointmentDuration` INT(11) DEFAULT 180,
  `autoConfirm` TINYINT(1) DEFAULT 1,
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
-- 10. PRIMARY PHYSICIANS TABLE
-- ============================================================
CREATE TABLE `primaryphysicians` (
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
-- 11. CAREGIVER SPECIALTIES TABLE
-- ============================================================
CREATE TABLE `caregiverspecialties` (
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
-- 12. CAREGIVER AVAILABILITY TABLE
-- ============================================================
CREATE TABLE `caregiver_availability` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `caregiverId` INT(11) NOT NULL,
  `dayOfWeek` INT(11) NOT NULL,
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
-- 13. APPOINTMENTS TABLE
-- ============================================================
CREATE TABLE `appointments` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `patientId` INT(11) NOT NULL,
  `caregiverId` INT(11) NOT NULL,
  `specialtyId` INT(11) NOT NULL,
  `scheduledDate` DATETIME NOT NULL,
  `duration` INT(11) NOT NULL,
  `sessionType` ENUM('in_person', 'teleconference') NOT NULL,
  `status` ENUM('pending', 'session_waiting', 'session_attended', 'session_cancelled', 'session_rescheduled') DEFAULT 'pending',
  `notes` TEXT DEFAULT NULL,
  `bookingFee` DECIMAL(10,2) NOT NULL,
  `sessionFee` DECIMAL(10,2) NOT NULL,
  `totalCost` DECIMAL(10,2) DEFAULT NULL,
  `timeSlotId` INT(11) DEFAULT NULL,
  `booking_fee_status` ENUM('pending', 'completed', 'failed', 'refunded') DEFAULT 'pending',
  `session_fee_status` ENUM('pending', 'completed', 'failed', 'refunded') DEFAULT 'pending',
  `paymentStatus` ENUM('pending', 'completed', 'failed', 'refunded') DEFAULT 'pending',
  `bookedAt` DATETIME DEFAULT NULL,
  `session_paid_at` DATETIME DEFAULT NULL,
  `patient_feedback` TEXT DEFAULT NULL,
  `patient_rating` INT(11) DEFAULT NULL,
  `reschedule_count` INT(11) DEFAULT 0,
  `last_rescheduled_at` DATETIME DEFAULT NULL,
  `reschedule_history` JSON DEFAULT NULL,
  `cancellation_reason` TEXT DEFAULT NULL,
  `cancelled_at` DATETIME DEFAULT NULL,
  `cancelled_by` ENUM('patient', 'system') DEFAULT NULL,
  `jitsi_room_name` VARCHAR(255) DEFAULT NULL,
  `jitsi_meeting_url` VARCHAR(500) DEFAULT NULL,
  `patient_meeting_token` VARCHAR(64) DEFAULT NULL,
  `caregiver_meeting_token` VARCHAR(64) DEFAULT NULL,
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
-- 14. TIME SLOTS TABLE
-- ============================================================
CREATE TABLE `time_slots` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `caregiverId` INT(11) NOT NULL,
  `date` DATE NOT NULL,
  `startTime` TIME NOT NULL,
  `endTime` TIME NOT NULL,
  `duration` INT(11) NOT NULL DEFAULT 180,
  `price` DECIMAL(10,2) DEFAULT NULL,
  `status` ENUM('available', 'locked', 'booked') DEFAULT 'available',
  `lockedUntil` DATETIME DEFAULT NULL,
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

-- Add FK for appointments.timeSlotId
ALTER TABLE `appointments`
  ADD CONSTRAINT `appointments_timeslot_fk` FOREIGN KEY (`timeSlotId`) REFERENCES `time_slots` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================================
-- 15. CAREGIVER RECOMMENDATIONS TABLE
-- ============================================================
CREATE TABLE `caregiverrecommendations` (
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
CREATE TABLE `pending_bookings` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `timeSlotId` INT(11) NOT NULL,
  `patientId` INT(11) NOT NULL,
  `caregiverId` INT(11) NOT NULL,
  `specialtyId` INT(11) NOT NULL,
  `locationId` INT(11) DEFAULT NULL,
  `sessionType` ENUM('in_person', 'teleconference') NOT NULL DEFAULT 'in_person',
  `notes` TEXT DEFAULT NULL,
  `tx_ref` VARCHAR(255) DEFAULT NULL,
  `bookingFee` DECIMAL(10,2) NOT NULL,
  `sessionFee` DECIMAL(10,2) NOT NULL,
  `totalAmount` DECIMAL(10,2) NOT NULL,
  `status` ENUM('pending', 'payment_initiated', 'payment_completed', 'payment_failed', 'expired', 'converted') DEFAULT 'pending',
  `expiresAt` DATETIME NOT NULL,
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
-- 17. PAYMENT TRANSACTIONS TABLE
-- ============================================================
CREATE TABLE `paymenttransactions` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `appointmentId` INT(11) NOT NULL,
  `amount` DECIMAL(10,2) NOT NULL,
  `baseFee` DECIMAL(10,2) DEFAULT NULL,
  `taxRate` DECIMAL(5,2) DEFAULT NULL,
  `taxAmount` DECIMAL(10,2) DEFAULT NULL,
  `convenienceFeeRate` DECIMAL(5,2) DEFAULT NULL,
  `convenienceFeeAmount` DECIMAL(10,2) DEFAULT NULL,
  `platformCommissionRate` DECIMAL(5,2) DEFAULT NULL,
  `platformCommissionAmount` DECIMAL(10,2) DEFAULT NULL,
  `caregiverEarnings` DECIMAL(10,2) DEFAULT NULL,
  `payment_type` ENUM('booking_fee', 'session_fee') NOT NULL DEFAULT 'booking_fee',
  `currency` VARCHAR(10) DEFAULT 'MWK',
  `paymentMethod` VARCHAR(255) NOT NULL,
  `stripePaymentIntentId` VARCHAR(255) DEFAULT NULL,
  `status` ENUM('pending', 'completed', 'failed', 'refunded') DEFAULT 'pending',
  `paidAt` DATETIME DEFAULT NULL,
  `refundedAt` DATETIME DEFAULT NULL,
  `metadata` JSON DEFAULT NULL,
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
CREATE TABLE `pending_payment_transactions` (
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
-- 19. TELECONFERENCE SESSIONS TABLE
-- ============================================================
CREATE TABLE `teleconferencesessions` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `appointmentId` INT(11) NOT NULL,
  `roomId` VARCHAR(255) NOT NULL,
  `startTime` DATETIME DEFAULT NULL,
  `endTime` DATETIME DEFAULT NULL,
  `recordingUrl` VARCHAR(500) DEFAULT NULL,
  `transcription` TEXT DEFAULT NULL,
  `chatHistory` JSON DEFAULT NULL,
  `session_status` VARCHAR(50) DEFAULT 'scheduled',
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
-- 20. CARE SESSION REPORTS TABLE
-- ============================================================
CREATE TABLE `caresessionreports` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `appointmentId` INT(11) NOT NULL,
  `observations` TEXT DEFAULT NULL,
  `interventions` TEXT DEFAULT NULL,
  `vitals` JSON DEFAULT NULL,
  `patientStatus` ENUM('stable', 'improving', 'deteriorating', 'critical', 'cured', 'deceased') DEFAULT NULL,
  `sessionSummary` TEXT DEFAULT NULL,
  `recommendations` TEXT DEFAULT NULL,
  `followUpRequired` TINYINT(1) DEFAULT 0,
  `follow_up_date` DATETIME DEFAULT NULL,
  `attachments` JSON DEFAULT NULL,
  `medications` TEXT DEFAULT NULL,
  `activities` TEXT DEFAULT NULL,
  `notes` TEXT DEFAULT NULL,
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `appointmentId` (`appointmentId`),
  CONSTRAINT `reports_appointment_fk` FOREIGN KEY (`appointmentId`) REFERENCES `appointments` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 21. STATUS ALERTS TABLE
-- ============================================================
CREATE TABLE `statusalerts` (
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
-- 22. MEETING SETTINGS TABLE
-- ============================================================
CREATE TABLE `meeting_settings` (
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
CREATE TABLE `teleconference_participant_sessions` (
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
CREATE TABLE `teleconference_events` (
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
-- 25. EMAIL QUEUE TABLE (Sequelize default name: EmailQueues)
-- ============================================================
CREATE TABLE `EmailQueues` (
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
('regional_manager', 'Regional manager with limited admin access');

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
('system_settings', 'Access system settings'),
('view_withdrawal_requests', 'View caregiver withdrawal requests and balances'),
('manage_withdrawals', 'Manage and process withdrawal requests');

-- Insert default meeting settings
INSERT INTO `meeting_settings` (`default_duration`, `allow_early_join_minutes`, `max_late_join_minutes`, `max_meeting_duration`, `record_meetings`, `video_quality`)
VALUES (60, 15, 30, 180, 0, 'high');

SET FOREIGN_KEY_CHECKS = 1;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
