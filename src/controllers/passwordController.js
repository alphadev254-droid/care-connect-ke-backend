const bcrypt = require('bcryptjs');
const { User } = require('../models');
const { bcryptRounds } = require('../config/auth');
const emailService = require('../services/emailService');

const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.id;

    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Verify current password
    const isValidPassword = await bcrypt.compare(currentPassword, user.password);
    if (!isValidPassword) {
      return res.status(400).json({ error: 'Current password is incorrect' });
    }

    // Hash new password
    const hashedNewPassword = await bcrypt.hash(newPassword, bcryptRounds);
    
    // Update password
    await user.update({ password: hashedNewPassword });

    // Send email notification
    try {
      await emailService.sendPasswordChangeNotification(user.email, user.firstName);
    } catch (emailError) {
      console.error('Failed to send password change email:', emailError);
      // Don't fail the request if email fails
    }

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  changePassword
};