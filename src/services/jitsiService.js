const crypto = require('crypto');
const { getPrimaryFrontendUrl } = require('../utils/config');

/**
 * Jitsi Meeting Service
 * Handles generation of Jitsi meeting links for teleconference appointments
 */

/**
 * Generate a unique, secure Jitsi room name for an appointment
 * @param {number} appointmentId - The appointment ID
 * @param {number} patientId - The patient ID
 * @param {number} caregiverId - The caregiver ID
 * @returns {string} Unique room name
 */
const generateJitsiRoomName = (appointmentId, patientId, caregiverId) => {
  // Create a unique, hard-to-guess room name
  const timestamp = Date.now();
  const dataToHash = `${appointmentId}-${patientId}-${caregiverId}-${timestamp}`;

  // Create a secure hash
  const hash = crypto
    .createHash('sha256')
    .update(dataToHash)
    .digest('hex')
    .substring(0, 16);

  // Format: CareConnect_AppointmentID_Hash
  return `CareConnect_${appointmentId}_${hash}`;
};

/**
 * Generate a full Jitsi meeting URL
 * @param {string} roomName - The room name
 * @param {string} domain - Jitsi domain (default: meet.jit.si or from env)
 * @returns {string} Full meeting URL
 */
const generateJitsiMeetingUrl = (roomName, domain = null) => {
  // Use domain from environment variable or default to meet.jit.si
  const jitsiDomain = domain || process.env.JITSI_DOMAIN || 'meet.jit.si';

  // Use http for localhost only, https for all other servers (including self-hosted)
  const protocol = jitsiDomain.includes('localhost') || jitsiDomain.includes('127.0.0.1')
    ? 'http'
    : 'https';

  return `${protocol}://${jitsiDomain}/${roomName}`;
};

/**
 * Generate complete Jitsi meeting details for an appointment with magic links
 * @param {number} appointmentId - The appointment ID
 * @param {number} patientId - The patient ID
 * @param {number} caregiverId - The caregiver ID
 * @returns {object} Object containing roomName, tokens, and unique URLs for patient and caregiver
 */
const generateJitsiMeeting = (appointmentId, patientId, caregiverId) => {
  const roomName = generateJitsiRoomName(appointmentId, patientId, caregiverId);

  // Generate unique magic link tokens for each participant
  const patientToken = crypto.randomBytes(32).toString('hex');
  const caregiverToken = crypto.randomBytes(32).toString('hex');

  // Generate app URL (not direct Jitsi URL)
  const appUrl = getPrimaryFrontendUrl() || 'http://localhost:8080';

  return {
    roomName,
    patientMeetingUrl: `${appUrl}/meeting/join/${patientToken}`,
    caregiverMeetingUrl: `${appUrl}/meeting/join/${caregiverToken}`,
    patientToken,
    caregiverToken,
    // Keep for backward compatibility
    meetingUrl: `${appUrl}/meeting/${appointmentId}`
  };
};

/**
 * Extract appointment ID from a Jitsi room name
 * @param {string} roomName - The room name
 * @returns {number|null} Appointment ID or null if invalid
 */
const extractAppointmentIdFromRoom = (roomName) => {
  const match = roomName.match(/CareConnect_(\d+)_/);
  return match ? parseInt(match[1]) : null;
};

/**
 * Validate if a room name is a valid CareConnect Jitsi room
 * @param {string} roomName - The room name to validate
 * @returns {boolean} True if valid CareConnect room name
 */
const isValidCareConnectRoom = (roomName) => {
  return roomName.startsWith('CareConnect_') && roomName.split('_').length === 3;
};

/**
 * Check if user can join the meeting based on appointment time with expiration
 * @param {Date} scheduledDate - Scheduled date/time of appointment
 * @param {number} duration - Appointment duration in minutes (default: 60)
 * @param {number} allowEarlyMinutes - Minutes before appointment to allow joining (default: from env or 15)
 * @param {number} allowLateMinutes - Minutes after appointment end to allow joining (default: from env or 30)
 * @returns {object} Object with canJoin status, message, and time details
 */
const canJoinMeeting = (scheduledDate, duration = 60, allowEarlyMinutes = null, allowLateMinutes = null) => {
  const appointmentTime = new Date(scheduledDate);
  const now = new Date();

  // Get configuration from environment or use defaults
  const earlyMinutes = allowEarlyMinutes !== null
    ? allowEarlyMinutes
    : parseInt(process.env.JITSI_ALLOW_EARLY_MINUTES) || 15;

  const lateMinutes = allowLateMinutes !== null
    ? allowLateMinutes
    : parseInt(process.env.JITSI_MAX_LATE_MINUTES) || 30;

  // Calculate meeting window times
  const meetingStartTime = new Date(appointmentTime.getTime() - (earlyMinutes * 60000));
  const meetingEndTime = new Date(appointmentTime.getTime() + ((duration + lateMinutes) * 60000));

  // Calculate differences
  const diffFromStart = (now.getTime() - meetingStartTime.getTime()) / (1000 * 60);
  const diffToEnd = (meetingEndTime.getTime() - now.getTime()) / (1000 * 60);
  const diffToAppointment = (appointmentTime.getTime() - now.getTime()) / (1000 * 60);

  // Check if before meeting window
  if (diffFromStart < 0) {
    const minutesUntilStart = Math.abs(Math.floor(diffFromStart));
    const hoursUntil = Math.floor(minutesUntilStart / 60);
    const minsRemaining = minutesUntilStart % 60;

    return {
      canJoin: false,
      status: 'too_early',
      message: `Meeting opens ${hoursUntil > 0 ? `${hoursUntil}h ` : ''}${minsRemaining}m before your appointment.`,
      timeUntilAvailable: minutesUntilStart,
      availableAt: meetingStartTime.toISOString(),
      expiresAt: meetingEndTime.toISOString()
    };
  }

  // Check if after meeting window
  if (diffToEnd < 0) {
    return {
      canJoin: false,
      status: 'expired',
      message: 'This meeting link has expired. Please contact support if you need assistance.',
      timeUntilAvailable: null,
      availableAt: meetingStartTime.toISOString(),
      expiresAt: meetingEndTime.toISOString(),
      expiredAt: now.toISOString()
    };
  }

  // Meeting is available
  const isBeforeAppointment = diffToAppointment > 0;
  const timeMessage = isBeforeAppointment
    ? `Your appointment starts in ${Math.floor(diffToAppointment)} minutes.`
    : `Your appointment is in progress.`;

  return {
    canJoin: true,
    status: 'available',
    message: `You can join the meeting now. ${timeMessage}`,
    timeUntilExpiry: Math.floor(diffToEnd),
    availableAt: meetingStartTime.toISOString(),
    expiresAt: meetingEndTime.toISOString()
  };
};

/**
 * Generate JWT token for Jitsi Secure Domain (if configured)
 * @param {object} user - User object with id, name, email, role
 * @param {string} roomName - The room name
 * @returns {string|null} JWT token or null if not configured
 */
const generateJitsiJWT = (user, roomName) => {
  // Only generate JWT if using secure domain
  if (!process.env.JITSI_APP_ID || !process.env.JITSI_APP_SECRET) {
    return null;
  }

  const jwt = require('jsonwebtoken');

  const payload = {
    context: {
      user: {
        id: user.id.toString(),
        name: user.name,
        email: user.email,
        moderator: user.role === 'caregiver' // Caregivers are moderators
      }
    },
    room: roomName,
    aud: process.env.JITSI_APP_ID,
    iss: process.env.JITSI_APP_ID,
    sub: process.env.JITSI_DOMAIN || 'meet.jit.si',
    exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24) // 24 hours
  };

  return jwt.sign(payload, process.env.JITSI_APP_SECRET);
};

module.exports = {
  generateJitsiRoomName,
  generateJitsiMeetingUrl,
  generateJitsiMeeting,
  extractAppointmentIdFromRoom,
  isValidCareConnectRoom,
  canJoinMeeting,
  generateJitsiJWT
};
