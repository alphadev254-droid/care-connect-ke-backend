const { Appointment, Patient, Caregiver, User, Specialty, sequelize } = require('../models');
const { canJoinMeeting, generateJitsiMeeting } = require('../services/jitsiService');
const { Op } = require('sequelize');
const logger = require('../utils/logger');
const crypto = require('crypto');
const { getPrimaryFrontendUrl } = require('../utils/config');

/**
 * Public endpoint - Join meeting using magic link token
 * No authentication required
 */
const joinMeetingWithToken = async (req, res, next) => {
  try {
    const { token } = req.params;

    if (!token) {
      return res.status(400).json({ error: 'Token is required' });
    }

    // Find appointment by either patient or caregiver token
    const appointment = await Appointment.findOne({
      where: {
        [Op.or]: [
          { patientMeetingToken: token },
          { caregiverMeetingToken: token }
        ]
      },
      include: [
        {
          model: Patient,
          include: [{ model: User, attributes: ['id', 'firstName', 'lastName', 'email'] }]
        },
        {
          model: Caregiver,
          include: [{ model: User, attributes: ['id', 'firstName', 'lastName', 'email'] }]
        },
        {
          model: Specialty,
          attributes: ['id', 'name']
        }
      ]
    });

    if (!appointment) {
      return res.status(404).json({
        error: 'Invalid meeting link',
        message: 'This meeting link is invalid or has expired. Please check your email for the correct link.'
      });
    }

    // Identify participant role
    const isPatient = appointment.patientMeetingToken === token;
    const isCaregiver = appointment.caregiverMeetingToken === token;

    const participant = isPatient
      ? {
          role: 'patient',
          id: appointment.Patient.id,
          userId: appointment.Patient.User.id,
          name: `${appointment.Patient.User.firstName} ${appointment.Patient.User.lastName}`,
          firstName: appointment.Patient.User.firstName,
          email: appointment.Patient.User.email,
          isModerator: false
        }
      : {
          role: 'caregiver',
          id: appointment.Caregiver.id,
          userId: appointment.Caregiver.User.id,
          name: `Dr. ${appointment.Caregiver.User.firstName} ${appointment.Caregiver.User.lastName}`,
          firstName: appointment.Caregiver.User.firstName,
          email: appointment.Caregiver.User.email,
          isModerator: true
        };

    // Check if user can join the meeting (time-based access control)
    const accessCheck = canJoinMeeting(
      appointment.scheduledDate,
      appointment.duration
    );

    // Prepare appointment details (hide sensitive info)
    const appointmentDetails = {
      id: appointment.id,
      scheduledDate: appointment.scheduledDate,
      duration: appointment.duration,
      sessionType: appointment.sessionType,
      specialty: appointment.Specialty?.name,
      patientName: `${appointment.Patient.User.firstName} ${appointment.Patient.User.lastName}`,
      caregiverName: `Dr. ${appointment.Caregiver.User.firstName} ${appointment.Caregiver.User.lastName}`,
      status: appointment.status
    };

    // Jitsi configuration
    const jitsiConfig = {
      domain: process.env.JITSI_DOMAIN || '91.108.121.232',
      roomName: appointment.jitsiRoomName,
      userInfo: {
        displayName: participant.name,
        email: participant.email
      },
      configOverwrite: {
        startWithAudioMuted: !participant.isModerator,
        startWithVideoMuted: false,
        prejoinPageEnabled: true
      }
    };

    logger.info('Meeting access requested', {
      appointmentId: appointment.id,
      participantRole: participant.role,
      participantId: participant.id,
      canJoin: accessCheck.canJoin
    });

    res.json({
      success: true,
      appointment: appointmentDetails,
      participant,
      accessCheck,
      jitsiConfig
    });

  } catch (error) {
    logger.error('Error in joinMeetingWithToken:', error);
    next(error);
  }
};

/**
 * Track when a participant joins the meeting
 * Saves to teleconference_participant_sessions table
 */
const trackMeetingJoin = async (req, res, next) => {
  try {
    const {
      appointmentId,
      participantRole,
      participantId,
      participantName,
      userId,
      deviceType,
      browser,
      operatingSystem,
      ipAddress,
      cameraEnabled,
      microphoneEnabled,
      isModerator
    } = req.body;

    logger.info('Participant joined meeting', {
      appointmentId,
      participantRole,
      participantId,
      participantName,
      joinedAt: new Date()
    });

    // Get or create teleconference session
    const appointment = await Appointment.findByPk(appointmentId);
    if (!appointment) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    // Find or create main session record
    let [session] = await sequelize.query(
      `SELECT id FROM teleconferencesessions WHERE appointmentId = ? LIMIT 1`,
      {
        replacements: [appointmentId],
        type: sequelize.QueryTypes.SELECT
      }
    );

    if (!session) {
      // Create new session
      const result = await sequelize.query(
        `INSERT INTO teleconferencesessions
        (appointmentId, roomId, jitsi_room_name, startTime, session_status, createdAt, updatedAt)
        VALUES (?, ?, ?, NOW(), 'active', NOW(), NOW())`,
        {
          replacements: [
            appointmentId,
            appointment.jitsiRoomName || `room_${appointmentId}`,
            appointment.jitsiRoomName
          ],
          type: sequelize.QueryTypes.INSERT
        }
      );
      session = { id: result[0] };
    } else {
      // Update session to active
      await sequelize.query(
        `UPDATE teleconferencesessions
        SET session_status = 'active', startTime = COALESCE(startTime, NOW())
        WHERE id = ?`,
        {
          replacements: [session.id],
          type: sequelize.QueryTypes.UPDATE
        }
      );
    }

    // Create participant session record
    await sequelize.query(
      `INSERT INTO teleconference_participant_sessions
      (teleconference_session_id, appointment_id, participant_id, participant_role,
       participant_name, user_id, joined_at, device_type, browser, operating_system,
       ip_address, camera_enabled, microphone_enabled, is_moderator, session_status,
       createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, NOW(), ?, ?, ?, ?, ?, ?, ?, 'active', NOW(), NOW())`,
      {
        replacements: [
          session.id,
          appointmentId,
          participantId,
          participantRole,
          participantName,
          userId || null,
          deviceType || null,
          browser || null,
          operatingSystem || null,
          ipAddress || req.ip,
          cameraEnabled !== false,
          microphoneEnabled !== false,
          isModerator || false
        ],
        type: sequelize.QueryTypes.INSERT
      }
    );

    // Log event
    await sequelize.query(
      `INSERT INTO teleconference_events
      (teleconference_session_id, event_type, event_data, timestamp)
      VALUES (?, 'join', ?, NOW())`,
      {
        replacements: [
          session.id,
          JSON.stringify({
            participantRole,
            participantId,
            participantName,
            deviceType,
            browser
          })
        ],
        type: sequelize.QueryTypes.INSERT
      }
    );

    // Update session participant count
    await sequelize.query(
      `UPDATE teleconferencesessions
      SET participant_count = (
        SELECT COUNT(DISTINCT participant_id)
        FROM teleconference_participant_sessions
        WHERE teleconference_session_id = ?
      ),
      peak_participants = GREATEST(
        peak_participants,
        (SELECT COUNT(*) FROM teleconference_participant_sessions
         WHERE teleconference_session_id = ? AND left_at IS NULL)
      )
      WHERE id = ?`,
      {
        replacements: [session.id, session.id, session.id],
        type: sequelize.QueryTypes.UPDATE
      }
    );

    res.json({
      success: true,
      message: 'Join tracked successfully',
      sessionId: session.id
    });

  } catch (error) {
    logger.error('Error tracking meeting join:', error);
    next(error);
  }
};

/**
 * Track when a participant leaves the meeting
 */
const trackMeetingLeave = async (req, res, next) => {
  try {
    const {
      appointmentId,
      participantRole,
      participantId,
      duration,
      disconnectionCount,
      connectionQuality,
      messagesCount,
      screenShared,
      issuesEncountered
    } = req.body;

    logger.info('Participant left meeting', {
      appointmentId,
      participantRole,
      participantId,
      duration,
      leftAt: new Date()
    });

    // Find the active participant session
    const [participantSession] = await sequelize.query(
      `SELECT tps.id, tps.teleconference_session_id, tps.joined_at
      FROM teleconference_participant_sessions tps
      WHERE tps.appointment_id = ?
        AND tps.participant_id = ?
        AND tps.participant_role = ?
        AND tps.left_at IS NULL
      ORDER BY tps.joined_at DESC
      LIMIT 1`,
      {
        replacements: [appointmentId, participantId, participantRole],
        type: sequelize.QueryTypes.SELECT
      }
    );

    if (participantSession) {
      // Calculate session duration
      const sessionDuration = duration || Math.floor(
        (new Date() - new Date(participantSession.joined_at)) / 1000
      );

      // Update participant session
      await sequelize.query(
        `UPDATE teleconference_participant_sessions
        SET left_at = NOW(),
            session_duration_seconds = ?,
            disconnection_count = ?,
            connection_quality = ?,
            messages_sent = ?,
            screen_shared = ?,
            issues_encountered = ?,
            session_status = 'completed'
        WHERE id = ?`,
        {
          replacements: [
            sessionDuration,
            disconnectionCount || 0,
            connectionQuality || null,
            messagesCount || 0,
            screenShared || false,
            issuesEncountered ? JSON.stringify(issuesEncountered) : null,
            participantSession.id
          ],
          type: sequelize.QueryTypes.UPDATE
        }
      );

      // Log event
      await sequelize.query(
        `INSERT INTO teleconference_events
        (teleconference_session_id, participant_session_id, event_type, event_data, timestamp)
        VALUES (?, ?, 'leave', ?, NOW())`,
        {
          replacements: [
            participantSession.teleconference_session_id,
            participantSession.id,
            JSON.stringify({ duration: sessionDuration, connectionQuality })
          ],
          type: sequelize.QueryTypes.UPDATE
        }
      );

      // Check if all participants have left
      const [activeParticipants] = await sequelize.query(
        `SELECT COUNT(*) as count
        FROM teleconference_participant_sessions
        WHERE teleconference_session_id = ? AND left_at IS NULL`,
        {
          replacements: [participantSession.teleconference_session_id],
          type: sequelize.QueryTypes.SELECT
        }
      );

      // If no active participants, mark session as completed
      if (activeParticipants.count === 0) {
        await sequelize.query(
          `UPDATE teleconferencesessions
          SET endTime = NOW(),
              session_status = 'completed',
              total_duration_seconds = TIMESTAMPDIFF(SECOND, startTime, NOW())
          WHERE id = ?`,
          {
            replacements: [participantSession.teleconference_session_id],
            type: sequelize.QueryTypes.UPDATE
          }
        );
      }
    }

    res.json({
      success: true,
      message: 'Leave tracked successfully'
    });

  } catch (error) {
    logger.error('Error tracking meeting leave:', error);
    next(error);
  }
};

/**
 * Admin: Get meeting settings
 */
const getMeetingSettings = async (req, res, next) => {
  try {
    const [settings] = await sequelize.query(
      `SELECT * FROM meeting_settings ORDER BY id DESC LIMIT 1`,
      { type: sequelize.QueryTypes.SELECT }
    );

    res.json({
      success: true,
      settings: settings || {}
    });
  } catch (error) {
    logger.error('Error getting meeting settings:', error);
    next(error);
  }
};

/**
 * Admin: Update meeting settings
 */
const updateMeetingSettings = async (req, res, next) => {
  try {
    const settings = req.body;

    // Get existing settings
    const [existing] = await sequelize.query(
      `SELECT id FROM meeting_settings LIMIT 1`,
      { type: sequelize.QueryTypes.SELECT }
    );

    if (existing) {
      // Update existing
      const updates = [];
      const values = [];

      Object.keys(settings).forEach(key => {
        updates.push(`${key} = ?`);
        values.push(settings[key]);
      });

      if (updates.length > 0) {
        values.push(existing.id);
        await sequelize.query(
          `UPDATE meeting_settings SET ${updates.join(', ')} WHERE id = ?`,
          { replacements: values, type: sequelize.QueryTypes.UPDATE }
        );
      }
    }

    res.json({
      success: true,
      message: 'Settings updated successfully'
    });
  } catch (error) {
    logger.error('Error updating meeting settings:', error);
    next(error);
  }
};

/**
 * Admin: Get all teleconference sessions with filters
 */
const getTeleconferenceSessions = async (req, res, next) => {
  try {
    const {
      status,
      startDate,
      endDate,
      page = 1,
      limit = 20
    } = req.query;

    const offset = (page - 1) * limit;
    const conditions = [];
    const replacements = [];

    if (status) {
      conditions.push('ts.session_status = ?');
      replacements.push(status);
    }

    if (startDate) {
      conditions.push('ts.startTime >= ?');
      replacements.push(startDate);
    }

    if (endDate) {
      conditions.push('ts.startTime <= ?');
      replacements.push(endDate);
    }

    const whereClause = conditions.length > 0
      ? `WHERE ${conditions.join(' AND ')}`
      : '';

    const sessions = await sequelize.query(
      `SELECT
        ts.*,
        a.scheduledDate,
        a.duration as scheduled_duration,
        a.sessionType,
        CONCAT(pu.firstName, ' ', pu.lastName) as patient_name,
        CONCAT(cu.firstName, ' ', cu.lastName) as caregiver_name,
        s.name as specialty_name
      FROM teleconferencesessions ts
      JOIN appointments a ON a.id = ts.appointmentId
      LEFT JOIN patients p ON p.id = a.patientId
      LEFT JOIN users pu ON pu.id = p.userId
      LEFT JOIN caregivers c ON c.id = a.caregiverId
      LEFT JOIN users cu ON cu.id = c.userId
      LEFT JOIN specialties s ON s.id = a.specialtyId
      ${whereClause}
      ORDER BY ts.startTime DESC
      LIMIT ? OFFSET ?`,
      {
        replacements: [...replacements, parseInt(limit), parseInt(offset)],
        type: sequelize.QueryTypes.SELECT
      }
    );

    const [{ total }] = await sequelize.query(
      `SELECT COUNT(*) as total FROM teleconferencesessions ts ${whereClause}`,
      {
        replacements,
        type: sequelize.QueryTypes.SELECT
      }
    );

    res.json({
      success: true,
      sessions,
      pagination: {
        total: parseInt(total),
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    logger.error('Error getting teleconference sessions:', error);
    next(error);
  }
};

/**
 * Admin: Get session details with participants
 */
const getSessionDetails = async (req, res, next) => {
  try {
    const { sessionId } = req.params;

    const [session] = await sequelize.query(
      `SELECT
        ts.*,
        a.scheduledDate,
        a.duration as scheduled_duration,
        a.sessionType,
        a.jitsi_room_name as jitsiRoomName,
        a.patient_meeting_token as patientMeetingToken,
        a.caregiver_meeting_token as caregiverMeetingToken,
        CONCAT(pu.firstName, ' ', pu.lastName) as patient_name,
        CONCAT(cu.firstName, ' ', cu.lastName) as caregiver_name,
        s.name as specialty_name
      FROM teleconferencesessions ts
      JOIN appointments a ON a.id = ts.appointmentId
      LEFT JOIN patients p ON p.id = a.patientId
      LEFT JOIN users pu ON pu.id = p.userId
      LEFT JOIN caregivers c ON c.id = a.caregiverId
      LEFT JOIN users cu ON cu.id = c.userId
      LEFT JOIN specialties s ON s.id = a.specialtyId
      WHERE ts.id = ?`,
      {
        replacements: [sessionId],
        type: sequelize.QueryTypes.SELECT
      }
    );

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Get participants
    const participants = await sequelize.query(
      `SELECT * FROM teleconference_participant_sessions
      WHERE teleconference_session_id = ?
      ORDER BY joined_at`,
      {
        replacements: [sessionId],
        type: sequelize.QueryTypes.SELECT
      }
    );

    // Get events
    const events = await sequelize.query(
      `SELECT * FROM teleconference_events
      WHERE teleconference_session_id = ?
      ORDER BY timestamp`,
      {
        replacements: [sessionId],
        type: sequelize.QueryTypes.SELECT
      }
    );

    res.json({
      success: true,
      session,
      participants,
      events
    });
  } catch (error) {
    logger.error('Error getting session details:', error);
    next(error);
  }
};

/**
 * Admin: Regenerate meeting tokens
 */
const regenerateMeetingTokens = async (req, res, next) => {
  try {
    const { appointmentId } = req.params;

    const appointment = await Appointment.findByPk(appointmentId, {
      include: [
        {
          model: Patient,
          include: [{ model: User, attributes: ['firstName', 'lastName', 'email'] }]
        },
        {
          model: Caregiver,
          include: [{ model: User, attributes: ['firstName', 'lastName', 'email'] }]
        },
        {
          model: Specialty,
          attributes: ['name']
        }
      ]
    });

    if (!appointment) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    // Generate new tokens
    const newPatientToken = crypto.randomBytes(32).toString('hex');
    const newCaregiverToken = crypto.randomBytes(32).toString('hex');

    await appointment.update({
      patientMeetingToken: newPatientToken,
      caregiverMeetingToken: newCaregiverToken
    });

    const appUrl = getPrimaryFrontendUrl() || 'http://localhost:8080';
    const patientMeetingUrl = `${appUrl}/meeting/join/${newPatientToken}`;
    const caregiverMeetingUrl = `${appUrl}/meeting/join/${newCaregiverToken}`;

    // Send new links via email to both participants
    if (appointment.Patient?.User?.email) {
      await emailService.sendAppointmentConfirmation(appointment.Patient.User.email, {
        patientName: `${appointment.Patient.User.firstName} ${appointment.Patient.User.lastName}`,
        caregiverName: appointment.Caregiver?.User
          ? `${appointment.Caregiver.User.firstName} ${appointment.Caregiver.User.lastName}`
          : 'Your Caregiver',
        appointmentDate: appointment.scheduledDate,
        duration: appointment.duration,
        sessionType: appointment.sessionType,
        specialty: appointment.Specialty?.name || 'General Care',
        jitsiMeetingUrl: patientMeetingUrl,
        isRescheduled: false,
        regenerated: true
      });
      logger.info(`Regenerated meeting link sent to patient: ${appointment.Patient.User.email}`);
    }

    if (appointment.Caregiver?.User?.email) {
      await emailService.sendCaregiverAppointmentNotification(appointment.Caregiver.User.email, {
        caregiverName: `${appointment.Caregiver.User.firstName} ${appointment.Caregiver.User.lastName}`,
        patientName: `${appointment.Patient.User.firstName} ${appointment.Patient.User.lastName}`,
        scheduledDate: appointment.scheduledDate,
        sessionType: appointment.sessionType,
        duration: appointment.duration,
        jitsiMeetingUrl: caregiverMeetingUrl,
        regenerated: true
      });
      logger.info(`Regenerated meeting link sent to caregiver: ${appointment.Caregiver.User.email}`);
    }

    res.json({
      success: true,
      message: 'Meeting tokens regenerated and new links sent via email',
      tokens: {
        patientMeetingUrl,
        caregiverMeetingUrl
      }
    });
  } catch (error) {
    logger.error('Error regenerating meeting tokens:', error);
    next(error);
  }
};

/**
 * Admin: Delete teleconference session
 */
const deleteSession = async (req, res, next) => {
  try {
    const { sessionId } = req.params;

    await sequelize.query(
      `DELETE FROM teleconferencesessions WHERE id = ?`,
      {
        replacements: [sessionId],
        type: sequelize.QueryTypes.DELETE
      }
    );

    res.json({
      success: true,
      message: 'Session deleted successfully'
    });
  } catch (error) {
    logger.error('Error deleting session:', error);
    next(error);
  }
};

/**
 * Admin: Get session statistics
 */
const getSessionStatistics = async (req, res, next) => {
  try {
    const [stats] = await sequelize.query(
      `SELECT
        COUNT(*) as total_sessions,
        SUM(CASE WHEN session_status = 'completed' THEN 1 ELSE 0 END) as completed_sessions,
        SUM(CASE WHEN session_status = 'active' THEN 1 ELSE 0 END) as active_sessions,
        AVG(total_duration_seconds) as avg_duration,
        AVG(participant_count) as avg_participants,
        SUM(total_disconnections) as total_disconnections
      FROM teleconferencesessions`,
      { type: sequelize.QueryTypes.SELECT }
    );

    res.json({
      success: true,
      statistics: stats
    });
  } catch (error) {
    logger.error('Error getting statistics:', error);
    next(error);
  }
};

module.exports = {
  joinMeetingWithToken,
  trackMeetingJoin,
  trackMeetingLeave,
  getMeetingSettings,
  updateMeetingSettings,
  getTeleconferenceSessions,
  getSessionDetails,
  regenerateMeetingTokens,
  deleteSession,
  getSessionStatistics
};
