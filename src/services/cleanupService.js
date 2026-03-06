const cron = require('node-cron');
const { PendingBooking, TimeSlot, Appointment } = require('../models');
const { Op } = require('sequelize');
const logger = require('../utils/logger');
const bookingService = require('./bookingService');

class CleanupService {
  constructor() {
    this.isRunning = false;
    this.cronJob = null;
    this.appointmentCleanupJob = null;
  }

  async cleanupExpiredBookings() {
    if (this.isRunning) {
      logger.info('Cleanup already running, skipping...');
      return;
    }

    this.isRunning = true;
    
    try {
      // Use booking service cleanup method
      const result = await bookingService.releaseExpiredLocks();
      return result;
    } catch (error) {
      logger.error('Cleanup failed:', error);
      throw error;
    } finally {
      this.isRunning = false;
    }
  }

  async autoCleanupDueBookings() {
    try {
      const cleanupHours = parseInt(process.env.AUTO_CLEANUP_DUE_HOURS) || 30;
      const cutoffTime = new Date(Date.now() - (cleanupHours * 60 * 60 * 1000));

      logger.info(`Starting auto cleanup for appointments older than ${cleanupHours} hours (before ${cutoffTime.toISOString()})`);

      // Find appointments that are 30+ hours past their scheduled end time
      const dueAppointments = await Appointment.findAll({
        where: {
          status: {
            [Op.in]: ['scheduled', 'confirmed', 'session_waiting', 'pending']
          },
          scheduledDate: {
            [Op.lt]: cutoffTime
          }
        },
        include: [{ model: TimeSlot }]
      });

      let cleanedCount = 0;
      let errorCount = 0;

      for (const appointment of dueAppointments) {
        const transaction = await Appointment.sequelize.transaction();
        
        try {
          // Release time slot
          if (appointment.TimeSlot) {
            await appointment.TimeSlot.update({
              status: 'available',
              isBooked: false,
              appointmentId: null
            }, { transaction });
          }

          // Cancel appointment
          await appointment.update({
            status: 'cancelled',
            cancellationReason: 'Automatically cancelled - appointment overdue',
            cancelledAt: new Date(),
            cancelledBy: 'system'
          }, { transaction });

          await transaction.commit();
          cleanedCount++;
          
          logger.info(`Cleaned up overdue appointment ${appointment.id}`);
        } catch (error) {
          await transaction.rollback();
          errorCount++;
          logger.error(`Failed to cleanup appointment ${appointment.id}:`, error);
        }
      }

      logger.info(`Appointment cleanup completed: ${cleanedCount} appointments cleaned, ${errorCount} errors, ${dueAppointments.length} total found`);
      
      return {
        success: true,
        cleanedCount,
        errorCount,
        totalFound: dueAppointments.length
      };
    } catch (error) {
      logger.error('Appointment auto cleanup failed:', error);
      throw error;
    }
  }

  startCleanupJob() {
    // Run every 5 minutes for expired bookings
    this.cronJob = cron.schedule('*/5 * * * *', async () => {
      try {
        await this.cleanupExpiredBookings();
      } catch (error) {
        logger.error('Scheduled cleanup failed:', error);
      }
    });

    // Run every hour for overdue appointments
    this.appointmentCleanupJob = cron.schedule('0 * * * *', async () => {
      try {
        await this.autoCleanupDueBookings();
      } catch (error) {
        logger.error('Scheduled appointment cleanup failed:', error);
      }
    });

    logger.info('Cleanup jobs started (expired bookings: every 5 minutes, overdue appointments: every hour)');
  }

  stopCleanupJob() {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
    }
    if (this.appointmentCleanupJob) {
      this.appointmentCleanupJob.stop();
      this.appointmentCleanupJob = null;
    }
    logger.info('Cleanup jobs stopped');
  }

  async runManualCleanup() {
    logger.info('Manual cleanup triggered');
    const bookingResult = await this.cleanupExpiredBookings();
    const appointmentResult = await this.autoCleanupDueBookings();
    return { bookingResult, appointmentResult };
  }
}

const cleanupService = new CleanupService();

module.exports = cleanupService;