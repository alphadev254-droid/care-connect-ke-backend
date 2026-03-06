-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1:3306
-- Generation Time: Dec 14, 2025 at 04:33 AM
-- Server version: 10.4.32-MariaDB
-- PHP Version: 8.4.11

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `home_care_db`
--

-- --------------------------------------------------------

--
-- Table structure for table `appointments`
--

CREATE TABLE `appointments` (
  `id` int(11) NOT NULL,
  `patientId` int(11) NOT NULL,
  `caregiverId` int(11) NOT NULL,
  `specialtyId` int(11) NOT NULL,
  `scheduledDate` datetime NOT NULL,
  `duration` int(11) NOT NULL,
  `sessionType` enum('in_person','teleconference') NOT NULL,
  `status` enum('pending','confirmed','completed','cancelled') DEFAULT 'pending',
  `notes` text DEFAULT NULL,
  `totalCost` decimal(10,2) DEFAULT NULL,
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

-- --------------------------------------------------------

--
-- Table structure for table `caregiverrecommendations`
--

CREATE TABLE `caregiverrecommendations` (
  `id` int(11) NOT NULL,
  `physicianId` int(11) NOT NULL,
  `patientId` int(11) NOT NULL,
  `caregiverId` int(11) NOT NULL,
  `specialtyId` int(11) NOT NULL,
  `reason` text NOT NULL,
  `isAccepted` tinyint(1) DEFAULT NULL,
  `acceptedAt` datetime DEFAULT NULL,
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

-- --------------------------------------------------------

--
-- Table structure for table `caregivers`
--

CREATE TABLE `caregivers` (
  `id` int(11) NOT NULL,
  `userId` int(11) NOT NULL,
  `licenseNumber` varchar(255) NOT NULL,
  `experience` int(11) NOT NULL,
  `qualifications` text NOT NULL,
  `verificationStatus` enum('pending','verified','rejected') DEFAULT 'pending',
  `hourlyRate` decimal(10,2) NOT NULL,
  `availability` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin CHECK (json_valid(`availability`)),
  `bio` text DEFAULT NULL,
  `profileImage` varchar(255) DEFAULT NULL,
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

-- --------------------------------------------------------

--
-- Table structure for table `caregiverspecialties`
--

CREATE TABLE `caregiverspecialties` (
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL,
  `CaregiverId` int(11) NOT NULL,
  `SpecialtyId` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

-- --------------------------------------------------------

--
-- Table structure for table `caresessionreports`
--

CREATE TABLE `caresessionreports` (
  `id` int(11) NOT NULL,
  `appointmentId` int(11) NOT NULL,
  `observations` text NOT NULL,
  `interventions` text NOT NULL,
  `vitals` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin CHECK (json_valid(`vitals`)),
  `patientStatus` enum('stable','improving','deteriorating','critical','cured','deceased') NOT NULL,
  `sessionSummary` text NOT NULL,
  `recommendations` text DEFAULT NULL,
  `followUpRequired` tinyint(1) DEFAULT 0,
  `attachments` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin CHECK (json_valid(`attachments`)),
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

-- --------------------------------------------------------

--
-- Table structure for table `patients`
--

CREATE TABLE `patients` (
  `id` int(11) NOT NULL,
  `userId` int(11) NOT NULL,
  `dateOfBirth` datetime NOT NULL,
  `address` text NOT NULL,
  `emergencyContact` varchar(255) NOT NULL,
  `medicalHistory` text DEFAULT NULL,
  `currentMedications` text DEFAULT NULL,
  `allergies` text DEFAULT NULL,
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Dumping data for table `patients`
--

INSERT INTO `patients` (`id`, `userId`, `dateOfBirth`, `address`, `emergencyContact`, `medicalHistory`, `currentMedications`, `allergies`, `createdAt`, `updatedAt`) VALUES
(1, 1, '1990-01-01 00:00:00', '123 Main St, City, State', 'emergency@example.com', 'No significant history', 'None', 'None known', '2025-12-10 14:50:54', '2025-12-10 14:50:54');

-- --------------------------------------------------------

--
-- Table structure for table `paymenttransactions`
--

CREATE TABLE `paymenttransactions` (
  `id` int(11) NOT NULL,
  `appointmentId` int(11) NOT NULL,
  `amount` decimal(10,2) NOT NULL,
  `currency` varchar(255) DEFAULT 'USD',
  `paymentMethod` varchar(255) NOT NULL,
  `stripePaymentIntentId` varchar(255) DEFAULT NULL,
  `status` enum('pending','completed','failed','refunded') DEFAULT 'pending',
  `paidAt` datetime DEFAULT NULL,
  `refundedAt` datetime DEFAULT NULL,
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

-- --------------------------------------------------------

--
-- Table structure for table `primaryphysicians`
--

CREATE TABLE `primaryphysicians` (
  `id` int(11) NOT NULL,
  `userId` int(11) NOT NULL,
  `medicalLicenseNumber` varchar(255) NOT NULL,
  `specialization` varchar(255) NOT NULL,
  `hospitalAffiliation` varchar(255) DEFAULT NULL,
  `verificationStatus` enum('pending','verified','rejected') DEFAULT 'pending',
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

-- --------------------------------------------------------

--
-- Table structure for table `specialties`
--

CREATE TABLE `specialties` (
  `id` int(11) NOT NULL,
  `name` varchar(255) NOT NULL,
  `description` text DEFAULT NULL,
  `isActive` tinyint(1) DEFAULT 1,
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

-- --------------------------------------------------------

--
-- Table structure for table `statusalerts`
--

CREATE TABLE `statusalerts` (
  `id` int(11) NOT NULL,
  `patientId` int(11) NOT NULL,
  `reportId` int(11) NOT NULL,
  `severity` enum('low','medium','high','critical') NOT NULL,
  `message` text NOT NULL,
  `isRead` tinyint(1) DEFAULT 0,
  `readAt` datetime DEFAULT NULL,
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

-- --------------------------------------------------------

--
-- Table structure for table `teleconferencesessions`
--

CREATE TABLE `teleconferencesessions` (
  `id` int(11) NOT NULL,
  `appointmentId` int(11) NOT NULL,
  `roomId` varchar(255) NOT NULL,
  `startTime` datetime DEFAULT NULL,
  `endTime` datetime DEFAULT NULL,
  `recordingUrl` varchar(255) DEFAULT NULL,
  `transcription` text DEFAULT NULL,
  `chatHistory` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin CHECK (json_valid(`chatHistory`)),
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

CREATE TABLE `users` (
  `id` int(11) NOT NULL,
  `email` varchar(255) NOT NULL,
  `password` varchar(255) NOT NULL,
  `firstName` varchar(255) NOT NULL,
  `lastName` varchar(255) NOT NULL,
  `phone` varchar(255) NOT NULL,
  `role` enum('patient','caregiver','primary_physician','system_manager','regional_manager') NOT NULL,
  `isActive` tinyint(1) DEFAULT 1,
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Dumping data for table `users`
--

INSERT INTO `users` (`id`, `email`, `password`, `firstName`, `lastName`, `phone`, `role`, `isActive`, `createdAt`, `updatedAt`) VALUES
(1, 'patient@example.com', '$2b$10$uLWJcG5KVmRG/fZcN4pLt.QlT7jBi5qvEYptd5Ltpb9MVle1ZjYFO', 'John', 'Doe', '+1234567890', 'patient', 1, '2025-12-10 14:50:54', '2025-12-10 14:50:54');

--
-- Indexes for dumped tables
--

--
-- Indexes for table `appointments`
--
ALTER TABLE `appointments`
  ADD PRIMARY KEY (`id`),
  ADD KEY `patientId` (`patientId`),
  ADD KEY `caregiverId` (`caregiverId`),
  ADD KEY `specialtyId` (`specialtyId`);

--
-- Indexes for table `caregiverrecommendations`
--
ALTER TABLE `caregiverrecommendations`
  ADD PRIMARY KEY (`id`),
  ADD KEY `physicianId` (`physicianId`),
  ADD KEY `patientId` (`patientId`),
  ADD KEY `caregiverId` (`caregiverId`),
  ADD KEY `specialtyId` (`specialtyId`);

--
-- Indexes for table `caregivers`
--
ALTER TABLE `caregivers`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `licenseNumber` (`licenseNumber`),
  ADD UNIQUE KEY `licenseNumber_2` (`licenseNumber`),
  ADD UNIQUE KEY `licenseNumber_3` (`licenseNumber`),
  ADD KEY `userId` (`userId`);

--
-- Indexes for table `caregiverspecialties`
--
ALTER TABLE `caregiverspecialties`
  ADD PRIMARY KEY (`CaregiverId`,`SpecialtyId`),
  ADD KEY `SpecialtyId` (`SpecialtyId`);

--
-- Indexes for table `caresessionreports`
--
ALTER TABLE `caresessionreports`
  ADD PRIMARY KEY (`id`),
  ADD KEY `appointmentId` (`appointmentId`);

--
-- Indexes for table `patients`
--
ALTER TABLE `patients`
  ADD PRIMARY KEY (`id`),
  ADD KEY `userId` (`userId`);

--
-- Indexes for table `paymenttransactions`
--
ALTER TABLE `paymenttransactions`
  ADD PRIMARY KEY (`id`),
  ADD KEY `appointmentId` (`appointmentId`);

--
-- Indexes for table `primaryphysicians`
--
ALTER TABLE `primaryphysicians`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `medicalLicenseNumber` (`medicalLicenseNumber`),
  ADD UNIQUE KEY `medicalLicenseNumber_2` (`medicalLicenseNumber`),
  ADD UNIQUE KEY `medicalLicenseNumber_3` (`medicalLicenseNumber`),
  ADD KEY `userId` (`userId`);

--
-- Indexes for table `specialties`
--
ALTER TABLE `specialties`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `name` (`name`),
  ADD UNIQUE KEY `name_2` (`name`),
  ADD UNIQUE KEY `name_3` (`name`);

--
-- Indexes for table `statusalerts`
--
ALTER TABLE `statusalerts`
  ADD PRIMARY KEY (`id`),
  ADD KEY `patientId` (`patientId`),
  ADD KEY `reportId` (`reportId`);

--
-- Indexes for table `teleconferencesessions`
--
ALTER TABLE `teleconferencesessions`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `roomId` (`roomId`),
  ADD UNIQUE KEY `roomId_2` (`roomId`),
  ADD UNIQUE KEY `roomId_3` (`roomId`),
  ADD KEY `appointmentId` (`appointmentId`);

--
-- Indexes for table `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `email` (`email`),
  ADD UNIQUE KEY `email_2` (`email`),
  ADD UNIQUE KEY `email_3` (`email`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `appointments`
--
ALTER TABLE `appointments`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `caregiverrecommendations`
--
ALTER TABLE `caregiverrecommendations`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `caregivers`
--
ALTER TABLE `caregivers`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `caresessionreports`
--
ALTER TABLE `caresessionreports`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `patients`
--
ALTER TABLE `patients`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `paymenttransactions`
--
ALTER TABLE `paymenttransactions`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `primaryphysicians`
--
ALTER TABLE `primaryphysicians`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `specialties`
--
ALTER TABLE `specialties`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `statusalerts`
--
ALTER TABLE `statusalerts`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `teleconferencesessions`
--
ALTER TABLE `teleconferencesessions`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `users`
--
ALTER TABLE `users`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `appointments`
--
ALTER TABLE `appointments`
  ADD CONSTRAINT `appointments_ibfk_1` FOREIGN KEY (`patientId`) REFERENCES `patients` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `appointments_ibfk_2` FOREIGN KEY (`caregiverId`) REFERENCES `caregivers` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `appointments_ibfk_3` FOREIGN KEY (`specialtyId`) REFERENCES `specialties` (`id`),
  ADD CONSTRAINT `appointments_ibfk_4` FOREIGN KEY (`patientId`) REFERENCES `patients` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `appointments_ibfk_5` FOREIGN KEY (`caregiverId`) REFERENCES `caregivers` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `appointments_ibfk_6` FOREIGN KEY (`specialtyId`) REFERENCES `specialties` (`id`),
  ADD CONSTRAINT `appointments_ibfk_7` FOREIGN KEY (`patientId`) REFERENCES `patients` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `appointments_ibfk_8` FOREIGN KEY (`caregiverId`) REFERENCES `caregivers` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `appointments_ibfk_9` FOREIGN KEY (`specialtyId`) REFERENCES `specialties` (`id`);

--
-- Constraints for table `caregiverrecommendations`
--
ALTER TABLE `caregiverrecommendations`
  ADD CONSTRAINT `caregiverrecommendations_ibfk_1` FOREIGN KEY (`physicianId`) REFERENCES `primaryphysicians` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `caregiverrecommendations_ibfk_10` FOREIGN KEY (`patientId`) REFERENCES `patients` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `caregiverrecommendations_ibfk_11` FOREIGN KEY (`caregiverId`) REFERENCES `caregivers` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `caregiverrecommendations_ibfk_12` FOREIGN KEY (`specialtyId`) REFERENCES `specialties` (`id`),
  ADD CONSTRAINT `caregiverrecommendations_ibfk_2` FOREIGN KEY (`patientId`) REFERENCES `patients` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `caregiverrecommendations_ibfk_3` FOREIGN KEY (`caregiverId`) REFERENCES `caregivers` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `caregiverrecommendations_ibfk_4` FOREIGN KEY (`specialtyId`) REFERENCES `specialties` (`id`),
  ADD CONSTRAINT `caregiverrecommendations_ibfk_5` FOREIGN KEY (`physicianId`) REFERENCES `primaryphysicians` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `caregiverrecommendations_ibfk_6` FOREIGN KEY (`patientId`) REFERENCES `patients` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `caregiverrecommendations_ibfk_7` FOREIGN KEY (`caregiverId`) REFERENCES `caregivers` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `caregiverrecommendations_ibfk_8` FOREIGN KEY (`specialtyId`) REFERENCES `specialties` (`id`),
  ADD CONSTRAINT `caregiverrecommendations_ibfk_9` FOREIGN KEY (`physicianId`) REFERENCES `primaryphysicians` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `caregivers`
--
ALTER TABLE `caregivers`
  ADD CONSTRAINT `caregivers_ibfk_1` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `caregivers_ibfk_2` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `caregivers_ibfk_3` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `caregiverspecialties`
--
ALTER TABLE `caregiverspecialties`
  ADD CONSTRAINT `caregiverspecialties_ibfk_1` FOREIGN KEY (`CaregiverId`) REFERENCES `caregivers` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `caregiverspecialties_ibfk_2` FOREIGN KEY (`SpecialtyId`) REFERENCES `specialties` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `caresessionreports`
--
ALTER TABLE `caresessionreports`
  ADD CONSTRAINT `caresessionreports_ibfk_1` FOREIGN KEY (`appointmentId`) REFERENCES `appointments` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `caresessionreports_ibfk_2` FOREIGN KEY (`appointmentId`) REFERENCES `appointments` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `caresessionreports_ibfk_3` FOREIGN KEY (`appointmentId`) REFERENCES `appointments` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `patients`
--
ALTER TABLE `patients`
  ADD CONSTRAINT `patients_ibfk_1` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `patients_ibfk_2` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `patients_ibfk_3` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `paymenttransactions`
--
ALTER TABLE `paymenttransactions`
  ADD CONSTRAINT `paymenttransactions_ibfk_1` FOREIGN KEY (`appointmentId`) REFERENCES `appointments` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `paymenttransactions_ibfk_2` FOREIGN KEY (`appointmentId`) REFERENCES `appointments` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `paymenttransactions_ibfk_3` FOREIGN KEY (`appointmentId`) REFERENCES `appointments` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `primaryphysicians`
--
ALTER TABLE `primaryphysicians`
  ADD CONSTRAINT `primaryphysicians_ibfk_1` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `primaryphysicians_ibfk_2` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `primaryphysicians_ibfk_3` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `statusalerts`
--
ALTER TABLE `statusalerts`
  ADD CONSTRAINT `statusalerts_ibfk_1` FOREIGN KEY (`patientId`) REFERENCES `patients` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `statusalerts_ibfk_2` FOREIGN KEY (`reportId`) REFERENCES `caresessionreports` (`id`),
  ADD CONSTRAINT `statusalerts_ibfk_3` FOREIGN KEY (`patientId`) REFERENCES `patients` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `statusalerts_ibfk_4` FOREIGN KEY (`reportId`) REFERENCES `caresessionreports` (`id`),
  ADD CONSTRAINT `statusalerts_ibfk_5` FOREIGN KEY (`patientId`) REFERENCES `patients` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `statusalerts_ibfk_6` FOREIGN KEY (`reportId`) REFERENCES `caresessionreports` (`id`);

--
-- Constraints for table `teleconferencesessions`
--
ALTER TABLE `teleconferencesessions`
  ADD CONSTRAINT `teleconferencesessions_ibfk_1` FOREIGN KEY (`appointmentId`) REFERENCES `appointments` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `teleconferencesessions_ibfk_2` FOREIGN KEY (`appointmentId`) REFERENCES `appointments` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `teleconferencesessions_ibfk_3` FOREIGN KEY (`appointmentId`) REFERENCES `appointments` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
