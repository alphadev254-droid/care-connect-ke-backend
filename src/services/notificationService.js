const { Notification, User, Role } = require('../models');
const { Op } = require('sequelize');
const { executeBulkWithRetry } = require('../utils/databaseUtils');

class NotificationService {
  /**
   * Create a notification for a user
   */
  static async createNotification({
    userId,
    title,
    message,
    type = 'system',
    priority = 'medium',
    relatedId = null,
    relatedType = null,
    region = null,
    expiresAt = null
  }) {
    try {
      const notification = await Notification.create({
        userId,
        title,
        message,
        type,
        priority,
        relatedId,
        relatedType,
        region,
        expiresAt
      });
      return notification;
    } catch (error) {
      console.error('Error creating notification:', error);
      throw error;
    }
  }

  /**
   * Get notifications for a user with region filtering
   */
  static async getUserNotifications(userId, options = {}) {
    try {
      const { page = 1, limit = 20, unreadOnly = false } = options;
      
      // Get user to check their role and region
      const user = await User.findByPk(userId, {
        include: [{ model: Role }]
      });
      
      if (!user) {
        throw new Error('User not found');
      }

      const whereClause = { userId };
      
      // Add unread filter if requested
      if (unreadOnly) {
        whereClause.isRead = false;
      }

      // Add region filtering for regional managers and accountants
      if (user.assignedRegion && ['regional_manager', 'Accountant'].includes(user.Role.name)) {
        whereClause[Op.or] = [
          { region: null }, // Global notifications
          { region: user.assignedRegion } // Region-specific notifications
        ];
      }

      const notifications = await Notification.findAndCountAll({
        where: whereClause,
        order: [['createdAt', 'DESC']],
        limit: parseInt(limit),
        offset: (parseInt(page) - 1) * parseInt(limit)
      });

      return {
        notifications: notifications.rows,
        total: notifications.count,
        page: parseInt(page),
        totalPages: Math.ceil(notifications.count / parseInt(limit))
      };
    } catch (error) {
      console.error('Error fetching notifications:', error);
      throw error;
    }
  }

  /**
   * Get unread notification count for a user
   */
  static async getUnreadCount(userId) {
    try {
      // Get user to check their role and region
      const user = await User.findByPk(userId, {
        include: [{ model: Role }]
      });
      
      if (!user) {
        return 0;
      }

      const whereClause = { 
        userId,
        isRead: false
      };

      // Add region filtering for regional managers and accountants
      if (user.assignedRegion && ['regional_manager', 'Accountant'].includes(user.Role.name)) {
        whereClause[Op.or] = [
          { region: null }, // Global notifications
          { region: user.assignedRegion } // Region-specific notifications
        ];
      }

      const count = await Notification.count({ where: whereClause });
      return count;
    } catch (error) {
      console.error('Error getting unread count:', error);
      return 0;
    }
  }

  /**
   * Mark notification as read
   */
  static async markAsRead(notificationId, userId) {
    try {
      const [updatedRows] = await Notification.update(
        { isRead: true },
        { 
          where: { 
            id: notificationId,
            userId: userId
          }
        }
      );
      return updatedRows > 0;
    } catch (error) {
      console.error('Error marking notification as read:', error);
      throw error;
    }
  }

  /**
   * Mark all notifications as read for a user
   */
  static async markAllAsRead(userId) {
    try {
      const [updatedRows] = await Notification.update(
        { isRead: true },
        { 
          where: { 
            userId: userId,
            isRead: false
          }
        }
      );
      return updatedRows;
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      throw error;
    }
  }

  /**
   * Create notifications for multiple users (bulk) with retry logic
   */
  static async createBulkNotifications(notifications) {
    try {
      const createdNotifications = await executeBulkWithRetry(
        Notification, 
        notifications, 
        {
          ignoreDuplicates: true,
          validate: true
        }
      );
      return createdNotifications;
    } catch (error) {
      console.error('Error creating bulk notifications after retries:', error);
      throw error;
    }
  }

  /**
   * Delete expired notifications
   */
  static async cleanupExpiredNotifications() {
    try {
      const deletedCount = await Notification.destroy({
        where: {
          expiresAt: {
            [Op.lt]: new Date()
          }
        }
      });
      return deletedCount;
    } catch (error) {
      console.error('Error cleaning up expired notifications:', error);
      throw error;
    }
  }
}

module.exports = NotificationService;