const express = require('express');
const { authenticateToken } = require('../middleware/auth.middleware');
const { Patient, User, Caregiver, Appointment } = require('../models');

const router = express.Router();

router.use(authenticateToken);

// Get patients for caregiver
router.get('/caregiver', async (req, res, next) => {
  try {
    // Find caregiver by user ID
    const caregiver = await Caregiver.findOne({ where: { userId: req.user.id } });
    if (!caregiver) {
      return res.status(404).json({ error: 'Caregiver profile not found' });
    }

    // Get unique patients from appointments
    const appointments = await Appointment.findAll({
      where: { caregiverId: caregiver.id },
      include: [
        {
          model: Patient,
          include: [{ model: User, attributes: ['firstName', 'lastName', 'email', 'phone'] }]
        }
      ]
    });

    // Extract unique patients
    const patientsMap = new Map();
    appointments.forEach(appointment => {
      if (appointment.Patient && !patientsMap.has(appointment.Patient.id)) {
        patientsMap.set(appointment.Patient.id, appointment.Patient);
      }
    });

    const patients = Array.from(patientsMap.values());

    res.json({ patients });
  } catch (error) {
    next(error);
  }
});

module.exports = router;