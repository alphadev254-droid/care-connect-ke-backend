-- Migration: Enhanced Teleconference Tracking System
-- Date: 2026-01-03
-- Purpose: Add comprehensive meeting tracking, settings, and participant session data

-- ===================================
-- 1. MEETING SETTINGS TABLE
-- ===================================
CREATE TABLE IF NOT EXISTS meeting_settings (
  id INT PRIMARY KEY AUTO_INCREMENT,

  -- Time Settings
  default_duration INT DEFAULT 60 COMMENT 'Default meeting duration in minutes',
  allow_early_join_minutes INT DEFAULT 15 COMMENT 'Minutes before scheduled time users can join',
  max_late_join_minutes INT DEFAULT 30 COMMENT 'Minutes after scheduled time users can still join',
  max_meeting_duration INT DEFAULT 180 COMMENT 'Maximum meeting duration in minutes',
  auto_end_after_minutes INT DEFAULT 30 COMMENT 'Auto-end meeting if inactive for X minutes',

  -- Meeting Features
  record_meetings BOOLEAN DEFAULT FALSE COMMENT 'Auto-record all meetings',
  require_moderator BOOLEAN DEFAULT TRUE COMMENT 'Meeting requires moderator to start',
  enable_chat BOOLEAN DEFAULT TRUE COMMENT 'Enable text chat',
  enable_screen_share BOOLEAN DEFAULT TRUE COMMENT 'Enable screen sharing',
  enable_recording BOOLEAN DEFAULT TRUE COMMENT 'Enable recording feature',
  enable_file_sharing BOOLEAN DEFAULT FALSE COMMENT 'Enable file sharing in chat',
  enable_virtual_background BOOLEAN DEFAULT TRUE COMMENT 'Enable virtual backgrounds',

  -- Quality Settings
  video_quality VARCHAR(20) DEFAULT 'high' COMMENT 'Default video quality: low, standard, high, ultra',
  max_participants INT DEFAULT 2 COMMENT 'Maximum participants per meeting',

  -- Timestamps
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_createdAt (createdAt)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Global teleconference meeting settings';

-- Insert default settings
INSERT INTO meeting_settings (
  default_duration,
  allow_early_join_minutes,
  max_late_join_minutes,
  max_meeting_duration,
  record_meetings,
  video_quality
) VALUES (60, 15, 30, 180, FALSE, 'high')
ON DUPLICATE KEY UPDATE id=id;

-- ===================================
-- 2. ENHANCE TELECONFERENCE SESSIONS TABLE
-- ===================================

-- Check if table exists, if not create it
CREATE TABLE IF NOT EXISTS teleconferencesessions (
  id INT PRIMARY KEY AUTO_INCREMENT,
  appointmentId INT NOT NULL,
  roomId VARCHAR(255) NOT NULL UNIQUE,
  startTime DATETIME NULL,
  endTime DATETIME NULL,
  recordingUrl VARCHAR(500) NULL,
  transcription TEXT NULL,
  chatHistory JSON NULL,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_appointment (appointmentId),
  INDEX idx_room (roomId),
  FOREIGN KEY (appointmentId) REFERENCES appointments(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Add new comprehensive tracking fields to existing table
ALTER TABLE teleconferencesessions
ADD COLUMN IF NOT EXISTS session_status VARCHAR(50) DEFAULT 'scheduled'
  COMMENT 'scheduled, active, completed, cancelled, failed',
ADD COLUMN IF NOT EXISTS total_duration_seconds INT NULL
  COMMENT 'Total session duration in seconds',
ADD COLUMN IF NOT EXISTS participant_count INT DEFAULT 0
  COMMENT 'Total number of participants who joined',
ADD COLUMN IF NOT EXISTS peak_participants INT DEFAULT 0
  COMMENT 'Maximum concurrent participants',
ADD COLUMN IF NOT EXISTS connection_quality VARCHAR(20) NULL
  COMMENT 'overall, good, fair, poor',
ADD COLUMN IF NOT EXISTS total_disconnections INT DEFAULT 0
  COMMENT 'Total number of disconnections',
ADD COLUMN IF NOT EXISTS recording_status VARCHAR(50) NULL
  COMMENT 'not_recorded, recording, recorded, failed',
ADD COLUMN IF NOT EXISTS recording_duration_seconds INT NULL
  COMMENT 'Recording duration in seconds',
ADD COLUMN IF NOT EXISTS jitsi_room_name VARCHAR(255) NULL
  COMMENT 'Jitsi room identifier',
ADD COLUMN IF NOT EXISTS session_notes TEXT NULL
  COMMENT 'Notes or issues during session',
ADD COLUMN IF NOT EXISTS metadata JSON NULL
  COMMENT 'Additional session metadata';

-- Add indexes for new fields
CREATE INDEX IF NOT EXISTS idx_session_status ON teleconferencesessions(session_status);
CREATE INDEX IF NOT EXISTS idx_start_time ON teleconferencesessions(startTime);
CREATE INDEX IF NOT EXISTS idx_end_time ON teleconferencesessions(endTime);

-- ===================================
-- 3. TELECONFERENCE PARTICIPANT SESSIONS TABLE
-- ===================================
CREATE TABLE IF NOT EXISTS teleconference_participant_sessions (
  id INT PRIMARY KEY AUTO_INCREMENT,

  -- Session & Participant Info
  teleconference_session_id INT NOT NULL COMMENT 'Link to main session',
  appointment_id INT NOT NULL COMMENT 'Appointment reference',
  participant_id INT NOT NULL COMMENT 'Patient or Caregiver ID',
  participant_role ENUM('patient', 'caregiver') NOT NULL COMMENT 'Role of participant',
  participant_name VARCHAR(255) NOT NULL COMMENT 'Participant display name',
  user_id INT NULL COMMENT 'User ID if available',

  -- Join/Leave Tracking
  joined_at TIMESTAMP NULL COMMENT 'When participant joined',
  left_at TIMESTAMP NULL COMMENT 'When participant left',
  session_duration_seconds INT NULL COMMENT 'Time spent in session (seconds)',

  -- Connection Info
  join_count INT DEFAULT 1 COMMENT 'Number of times joined (reconnections)',
  disconnection_count INT DEFAULT 0 COMMENT 'Number of disconnections',
  connection_quality VARCHAR(20) NULL COMMENT 'good, fair, poor',
  avg_bandwidth_kbps INT NULL COMMENT 'Average bandwidth in Kbps',

  -- Device & Browser Info
  device_type VARCHAR(50) NULL COMMENT 'desktop, mobile, tablet',
  browser VARCHAR(100) NULL COMMENT 'Browser name and version',
  operating_system VARCHAR(100) NULL COMMENT 'OS name and version',
  ip_address VARCHAR(45) NULL COMMENT 'IP address (IPv4 or IPv6)',

  -- Audio/Video Status
  camera_enabled BOOLEAN DEFAULT TRUE COMMENT 'Camera was enabled',
  microphone_enabled BOOLEAN DEFAULT TRUE COMMENT 'Microphone was enabled',
  screen_shared BOOLEAN DEFAULT FALSE COMMENT 'Screen was shared',

  -- Participation Metrics
  spoke_time_seconds INT DEFAULT 0 COMMENT 'Time with mic active',
  messages_sent INT DEFAULT 0 COMMENT 'Chat messages sent',
  reactions_sent INT DEFAULT 0 COMMENT 'Reactions/emojis sent',

  -- Issues
  issues_encountered JSON NULL COMMENT 'Any technical issues',
  error_logs TEXT NULL COMMENT 'Error messages if any',

  -- Status
  is_moderator BOOLEAN DEFAULT FALSE COMMENT 'Was moderator for session',
  session_status VARCHAR(50) DEFAULT 'active' COMMENT 'active, completed, abandoned',

  -- Timestamps
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  -- Indexes
  INDEX idx_session (teleconference_session_id),
  INDEX idx_appointment (appointment_id),
  INDEX idx_participant (participant_id, participant_role),
  INDEX idx_joined_at (joined_at),
  INDEX idx_left_at (left_at),
  INDEX idx_user (user_id),

  -- Foreign Keys
  FOREIGN KEY (teleconference_session_id) REFERENCES teleconferencesessions(id) ON DELETE CASCADE,
  FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE CASCADE

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Individual participant sessions within teleconference meetings';

-- ===================================
-- 4. TELECONFERENCE EVENTS LOG TABLE
-- ===================================
CREATE TABLE IF NOT EXISTS teleconference_events (
  id INT PRIMARY KEY AUTO_INCREMENT,

  teleconference_session_id INT NOT NULL,
  participant_session_id INT NULL COMMENT 'Null for session-level events',

  event_type VARCHAR(50) NOT NULL COMMENT 'join, leave, disconnect, reconnect, recording_start, recording_stop, screen_share_start, screen_share_stop, etc.',
  event_data JSON NULL COMMENT 'Additional event-specific data',

  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'When event occurred',

  INDEX idx_session (teleconference_session_id),
  INDEX idx_participant (participant_session_id),
  INDEX idx_event_type (event_type),
  INDEX idx_timestamp (timestamp),

  FOREIGN KEY (teleconference_session_id) REFERENCES teleconferencesessions(id) ON DELETE CASCADE,
  FOREIGN KEY (participant_session_id) REFERENCES teleconference_participant_sessions(id) ON DELETE CASCADE

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Detailed event log for all teleconference activities';

-- ===================================
-- 5. INDEXES FOR PERFORMANCE
-- ===================================

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_participant_role_joined
  ON teleconference_participant_sessions(participant_role, joined_at);

CREATE INDEX IF NOT EXISTS idx_session_status_time
  ON teleconferencesessions(session_status, startTime);

-- ===================================
-- SUMMARY OF TABLES
-- ===================================
-- meeting_settings: Global teleconference configuration
-- teleconferencesessions: Main session records (enhanced)
-- teleconference_participant_sessions: Individual participant tracking
-- teleconference_events: Detailed event log
