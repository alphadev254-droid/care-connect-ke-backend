const express = require('express');
const router = express.Router();
const db = require('../config/database');
const auth = require('../middleware/auth');

// Delete account
router.delete('/delete', auth, async (req, res) => {
  const connection = await db.getConnection();
  
  try {
    await connection.beginTransaction();
    
    const userId = req.user.id;
    const userRole = req.user.role;
    
    // Cancel future appointments
    await connection.execute(
      'UPDATE appointments SET status = "cancelled" WHERE (patient_id = ? OR caregiver_id = ?) AND appointment_date > NOW()',
      [userId, userId]
    );
    
    // Soft delete user account
    await connection.execute(
      'UPDATE users SET deleted_at = NOW(), email = CONCAT(email, "_deleted_", UNIX_TIMESTAMP()) WHERE id = ?',
      [userId]
    );
    
    // Role-specific cleanup
    if (userRole === 'patient') {
      await connection.execute(
        'UPDATE patients SET deleted_at = NOW() WHERE user_id = ?',
        [userId]
      );
    } else if (userRole === 'caregiver') {
      await connection.execute(
        'UPDATE caregivers SET deleted_at = NOW() WHERE user_id = ?',
        [userId]
      );
    }
    
    await connection.commit();
    
    res.json({
      success: true,
      message: 'Account deletion initiated. Your account will be fully processed within 30 days.'
    });
    
  } catch (error) {
    await connection.rollback();
    console.error('Account deletion error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete account'
    });
  } finally {
    connection.release();
  }
});

module.exports = router;