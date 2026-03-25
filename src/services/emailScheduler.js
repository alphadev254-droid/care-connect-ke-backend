const { EmailQueue } = require('../models');
const emailService = require('./emailService');

class EmailScheduler {
  static isProcessing = false;
  static processingJobs = new Set();
  
  static async queueEmail(to, template, data, scheduledAt = new Date()) {
    try {
      const emailJob = await EmailQueue.create({
        to,
        subject: this.getSubjectForTemplate(template),
        template,
        data,
        scheduledAt
      });
      
      console.log(`Email queued: ${template} to ${to}`);
      
      // Process critical emails immediately (but safely)
      const criticalEmails = ['data_protection_notification', 'caregiver_registration', 'password_reset'];
      if (criticalEmails.includes(template)) {
        console.log(`Processing critical email immediately: ${template}`);
        // Use setImmediate to avoid blocking and prevent conflicts
        setImmediate(() => this.processSingleEmailSafely(emailJob));
      }
      
      return emailJob;
    } catch (error) {
      console.error('Failed to queue email:', error);
      throw error;
    }
  }

  static getSubjectForTemplate(template) {
    const subjects = {
      'user_welcome': 'Welcome to TunzaConnect - Account Created',
      'caregiver_verification': 'Account Verified - TunzaConnect',
      'caregiver_rejection': 'Account Verification - TunzaConnect',
      'account_status_change': 'Account Status Update - TunzaConnect',
      'caregiver_registration': 'Registration Received - TunzaConnect',
      'password_reset': 'Password Reset Request - TunzaConnect',
      'password_change': 'Password Changed - TunzaConnect',
      'appointment_confirmation': 'Appointment Confirmation - TunzaConnect',
      'payment_confirmation': 'Payment Confirmation - TunzaConnect',
      'payment_failure': 'Payment Failed - TunzaConnect',
      'booking_expired': 'Booking Expired - TunzaConnect',
      'status_alert': 'Patient Status Alert',
      'reschedule_notification': 'Appointment Rescheduled - TunzaConnect',
      'cancellation_notification': 'Appointment Cancelled - TunzaConnect',
      'data_protection_notification': 'Data Protection Policy Acknowledgment - TunzaConnect'
    };
    return subjects[template] || 'Notification from TunzaConnect';
  }

  static async processEmailQueue() {
    // Prevent multiple queue processors running simultaneously
    if (this.isProcessing) {
      console.log('Email queue already being processed, skipping...');
      return;
    }

    this.isProcessing = true;
    
    try {
      const pendingEmails = await EmailQueue.findAll({
        where: {
          status: 'pending',
          scheduledAt: {
            [require('sequelize').Op.lte]: new Date()
          },
          attempts: {
            [require('sequelize').Op.lt]: 3
          }
        },
        limit: 5, // Reduced from 10 to prevent overload
        order: [['scheduledAt', 'ASC']]
      });

      console.log(`Processing ${pendingEmails.length} pending emails`);

      for (const emailJob of pendingEmails) {
        // Skip if already being processed
        if (this.processingJobs.has(emailJob.id)) {
          continue;
        }
        await this.processEmailJob(emailJob);
      }
    } catch (error) {
      console.error('Error processing email queue:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  static async processSingleEmailSafely(emailJob) {
    // Prevent duplicate processing of the same job
    if (this.processingJobs.has(emailJob.id)) {
      console.log(`Email job ${emailJob.id} already being processed`);
      return;
    }

    try {
      await this.processEmailJob(emailJob);
    } catch (error) {
      console.error(`Error processing single email job ${emailJob.id}:`, error);
    }
  }

  static async processEmailJob(emailJob) {
    // Add to processing set to prevent duplicates
    this.processingJobs.add(emailJob.id);
    
    try {
      await emailJob.update({ attempts: emailJob.attempts + 1 });

      let emailSent = false;
      
      switch (emailJob.template) {
        case 'user_welcome':
          await emailService.sendUserWelcomeEmail(emailJob.data);
          emailSent = true;
          break;
        case 'caregiver_verification':
          console.log('Processing caregiver_verification email');
          console.log('Email job data:', emailJob.data);
          console.log('firstName from data:', emailJob.data?.firstName);
          const firstName = typeof emailJob.data === 'string' ? JSON.parse(emailJob.data).firstName : emailJob.data?.firstName;
          console.log('Parsed firstName:', firstName);
          await emailService.sendCaregiverVerificationNotification(emailJob.to, firstName);
          emailSent = true;
          break;
        case 'caregiver_rejection':
          const rejectionData = typeof emailJob.data === 'string' ? JSON.parse(emailJob.data) : emailJob.data;
          await emailService.sendCaregiverRejectionNotification(emailJob.to, rejectionData?.firstName, rejectionData?.reason);
          emailSent = true;
          break;
        case 'account_status_change':
          const statusData = typeof emailJob.data === 'string' ? JSON.parse(emailJob.data) : emailJob.data;
          await emailService.sendAccountStatusNotification(emailJob.to, statusData?.firstName, statusData?.status === 'activated');
          emailSent = true;
          break;
        case 'caregiver_registration':
          const regData = typeof emailJob.data === 'string' ? JSON.parse(emailJob.data) : emailJob.data;
          await emailService.sendCaregiverRegistrationNotification(emailJob.to, regData?.firstName);
          emailSent = true;
          break;
        case 'password_reset':
          await emailService.sendPasswordResetEmail(emailJob.to, emailJob.data.firstName, emailJob.data.resetUrl);
          emailSent = true;
          break;
        case 'password_change':
          await emailService.sendPasswordChangeNotification(emailJob.to, emailJob.data.firstName);
          emailSent = true;
          break;
        case 'appointment_confirmation':
          await emailService.sendAppointmentConfirmation(emailJob.to, emailJob.data.appointmentDetails);
          emailSent = true;
          break;
        case 'payment_confirmation':
          await emailService.sendPaymentConfirmation(emailJob.to, emailJob.data.paymentDetails);
          emailSent = true;
          break;
        case 'payment_failure':
          await emailService.sendPaymentFailureNotification(emailJob.to, emailJob.data.paymentDetails);
          emailSent = true;
          break;
        case 'booking_expired':
          await emailService.sendBookingExpiredNotification(emailJob.to, emailJob.data.bookingDetails);
          emailSent = true;
          break;
        case 'status_alert':
          await emailService.sendStatusAlert(emailJob.to, emailJob.data.alertDetails);
          emailSent = true;
          break;
        case 'reschedule_notification':
          await emailService.sendRescheduleNotification(emailJob.to, emailJob.data.recipientName, emailJob.data.rescheduleBy, emailJob.data.rescheduleByName, emailJob.data.newDateTime);
          emailSent = true;
          break;
        case 'cancellation_notification':
          await emailService.sendCancellationNotification(emailJob.to, emailJob.data.recipientName, emailJob.data.appointmentDateTime, emailJob.data.reason);
          emailSent = true;
          break;
        case 'data_protection_notification':
          // For data protection, we need to pass the email in the userData object
          const userData = { ...emailJob.data, email: emailJob.to };
          await emailService.sendDataProtectionNotification(userData);
          emailSent = true;
          break;
        default:
          throw new Error(`Unknown email template: ${emailJob.template}`);
      }

      if (emailSent) {
        await emailJob.update({
          status: 'sent',
          sentAt: new Date(),
          error: null
        });
        console.log(`Email sent successfully: ${emailJob.template} to ${emailJob.to}`);
      }
    } catch (error) {
      console.error(`Failed to send email ${emailJob.id}:`, error);
      
      const status = emailJob.attempts >= 3 ? 'failed' : 'pending';
      await emailJob.update({
        status,
        error: error.message
      });
    } finally {
      // Always remove from processing set
      this.processingJobs.delete(emailJob.id);
    }
  }
}

module.exports = EmailScheduler;