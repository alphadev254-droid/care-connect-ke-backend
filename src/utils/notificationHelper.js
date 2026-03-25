const NotificationService = require('../services/notificationService');
const { User, Role } = require('../models');

class NotificationHelper {
  /**
   * Create appointment-related notifications
   */
  static async createAppointmentNotifications(appointmentData) {
    const notifications = [];

    // Notify caregiver about new appointment
    if (appointmentData.caregiverId) {
      notifications.push({
        userId: appointmentData.caregiverId,
        title: 'New Appointment Request',
        message: `You have a new appointment request for ${appointmentData.date} at ${appointmentData.time}`,
        type: 'appointment',
        priority: 'high',
        relatedId: appointmentData.id,
        relatedType: 'appointment'
      });
    }

    // Notify patient about appointment confirmation
    if (appointmentData.patientId) {
      notifications.push({
        userId: appointmentData.patientId,
        title: 'Appointment Confirmed',
        message: `Your appointment has been confirmed for ${appointmentData.date} at ${appointmentData.time}`,
        type: 'appointment',
        priority: 'medium',
        relatedId: appointmentData.id,
        relatedType: 'appointment'
      });
    }

    return await NotificationService.createBulkNotifications(notifications);
  }

  /**
   * Create caregiver verification notifications with error handling
   */
  static async createCaregiverVerificationNotifications(caregiverUserId, status, region = null) {
    try {
      const notifications = [];

      // Notify caregiver about verification status
      const title = status === 'APPROVED' ? 'Profile Verified' : 'Profile Verification Required';
      const message = status === 'APPROVED' 
        ? 'Congratulations! Your caregiver profile has been verified. You can now receive appointments.'
        : 'Your caregiver profile requires additional verification. Please check your email for details.';

      notifications.push({
        userId: caregiverUserId,
        title,
        message,
        type: 'verification',
        priority: 'high'
      });

      // Only notify system managers about new caregiver registration (not regional managers or accountants)
      if (status === 'PENDING') {
        const systemManagers = await User.findAll({
          include: [{
            model: Role,
            where: {
              name: 'system_manager'
            }
          }]
        });

        for (const manager of systemManagers) {
          notifications.push({
            userId: manager.id,
            title: 'New Caregiver Registration',
            message: `A new caregiver has registered and requires verification in ${region || 'system'}`,
            type: 'verification',
            priority: 'medium',
            region: region,
            relatedId: caregiverUserId,
            relatedType: 'caregiver'
          });
        }
      }

      return await NotificationService.createBulkNotifications(notifications);
    } catch (error) {
      console.error('Failed to create caregiver verification notifications:', error);
      // Don't throw the error to avoid blocking the registration process
      // Log it and continue - notifications are not critical for registration
      return null;
    }
  }

  /**
   * Create payment notifications
   */
  static async createPaymentNotifications(paymentData) {
    const notifications = [];

    // Notify patient about payment
    if (paymentData.patientId) {
      const title = paymentData.status === 'completed' ? 'Payment Successful' : 'Payment Failed';
      const message = paymentData.status === 'completed'
        ? `Your payment of Ksh ${paymentData.amount} has been processed successfully`
        : `Your payment of Ksh ${paymentData.amount} could not be processed. Please try again.`;

      notifications.push({
        userId: paymentData.patientId,
        title,
        message,
        type: 'payment',
        priority: paymentData.status === 'completed' ? 'medium' : 'high',
        relatedId: paymentData.id,
        relatedType: 'payment'
      });
    }

    // Notify caregiver about earnings (if payment completed)
    if (paymentData.status === 'completed' && paymentData.caregiverId) {
      notifications.push({
        userId: paymentData.caregiverId,
        title: 'Payment Received',
        message: `You have received Ksh ${paymentData.caregiverEarnings} for your completed session`,
        type: 'payment',
        priority: 'medium',
        relatedId: paymentData.id,
        relatedType: 'payment'
      });
    }

    // Notify accountants about session fee payments (for financial tracking)
    if (paymentData.status === 'completed' && paymentData.paymentType === 'session_fee') {
      const accountants = await User.findAll({
        include: [{
          model: Role,
          where: { name: 'Accountant' }
        }]
      });

      for (const accountant of accountants) {
        // Regional filtering for accountants
        if (!accountant.assignedRegion || accountant.assignedRegion === 'all' || accountant.assignedRegion === paymentData.region) {
          notifications.push({
            userId: accountant.id,
            title: 'Session Payment Completed',
            message: `Session fee payment of Ksh ${paymentData.amount} completed in ${paymentData.region || 'system'}`,
            type: 'payment',
            priority: 'low',
            region: paymentData.region,
            relatedId: paymentData.id,
            relatedType: 'payment'
          });
        }
      }
    }

    return await NotificationService.createBulkNotifications(notifications);
  }

  /**
   * Create system notifications for all users or specific roles
   */
  static async createSystemNotification(title, message, options = {}) {
    const { 
      roles = [], 
      region = null, 
      priority = 'medium',
      expiresAt = null 
    } = options;

    let users = [];

    if (roles.length > 0) {
      // Get users with specific roles
      users = await User.findAll({
        include: [{
          model: Role,
          where: {
            name: roles
          }
        }]
      });
    } else {
      // Get all users
      users = await User.findAll();
    }

    const notifications = users.map(user => ({
      userId: user.id,
      title,
      message,
      type: 'system',
      priority,
      region,
      expiresAt
    }));

    return await NotificationService.createBulkNotifications(notifications);
  }

  /**
   * Create care report notifications
   */
  static async createCareReportNotifications(reportData) {
    const notifications = [];

    // Notify patient about care report upload
    if (reportData.patientId) {
      notifications.push({
        userId: reportData.patientId,
        title: 'Care Report Available',
        message: `Your care report for the session on ${reportData.sessionDate} has been uploaded by your caregiver`,
        type: 'system',
        priority: 'medium',
        relatedId: reportData.id,
        relatedType: 'care_report'
      });
    }

    return await NotificationService.createBulkNotifications(notifications);
  }

  /**
   * Create appointment reminder notifications
   */
  static async createAppointmentReminders(appointmentData, reminderType = '24h') {
    const notifications = [];
    
    const reminderMessages = {
      '24h': 'You have an appointment tomorrow',
      '2h': 'You have an appointment in 2 hours',
      '30m': 'You have an appointment in 30 minutes'
    };

    const message = `${reminderMessages[reminderType]} at ${appointmentData.time}`;

    // Remind both patient and caregiver
    if (appointmentData.patientId) {
      notifications.push({
        userId: appointmentData.patientId,
        title: 'Appointment Reminder',
        message,
        type: 'reminder',
        priority: reminderType === '30m' ? 'high' : 'medium',
        relatedId: appointmentData.id,
        relatedType: 'appointment'
      });
    }

    if (appointmentData.caregiverId) {
      notifications.push({
        userId: appointmentData.caregiverId,
        title: 'Appointment Reminder',
        message,
        type: 'reminder',
        priority: reminderType === '30m' ? 'high' : 'medium',
        relatedId: appointmentData.id,
        relatedType: 'appointment'
      });
    }

    return await NotificationService.createBulkNotifications(notifications);
  }
}

module.exports = NotificationHelper;