const { Caregiver, User, Specialty, TimeSlot, Patient, Appointment, sequelize } = require('../models');
const { VERIFICATION_STATUS, TIMESLOT_STATUS } = require('../utils/constants');
const { Op } = require('sequelize');

const getCaregivers = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, specialtyId, verified = true, includeAvailability } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = {};
    let userWhereClause = { isActive: true }; // Only active users
    
    if (verified === 'true') {
      whereClause.verificationStatus = 'APPROVED'; // Only approved caregivers
    }

    let includeClause = [
      { 
        model: User, 
        where: userWhereClause,
        required: true 
      },
      { model: Specialty, through: { attributes: [] } }
    ];

    if (specialtyId) {
      includeClause[1].where = { id: specialtyId };
    }

    const caregivers = await Caregiver.findAndCountAll({
      where: whereClause,
      include: includeClause,
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['createdAt', 'DESC']]
    });

    // Add availability information if requested
    if (includeAvailability === 'true') {
      const caregiversWithAvailability = await Promise.all(
        caregivers.rows.map(async (caregiver) => {
          const availableSlots = await TimeSlot.count({
            where: {
              caregiverId: caregiver.id,
              status: TIMESLOT_STATUS.AVAILABLE,
              date: { [Op.gte]: new Date().toISOString().split('T')[0] }
            }
          });
          
          // Get rating statistics
          const ratingStats = await Appointment.findAll({
            where: {
              caregiverId: caregiver.id,
              patient_rating: { [Op.not]: null }
            },
            attributes: [
              [sequelize.fn('AVG', sequelize.col('patient_rating')), 'averageRating'],
              [sequelize.fn('COUNT', sequelize.col('patient_rating')), 'totalRatings']
            ],
            raw: true
          });
          
          return {
            ...caregiver.toJSON(),
            hasAvailableSlots: availableSlots > 0,
            availableSlotsCount: availableSlots,
            averageRating: ratingStats[0]?.averageRating ? parseFloat(ratingStats[0].averageRating).toFixed(1) : null,
            totalRatings: parseInt(ratingStats[0]?.totalRatings) || 0
          };
        })
      );
      
      return res.json({
        caregivers: caregiversWithAvailability,
        total: caregivers.count,
        page: parseInt(page),
        totalPages: Math.ceil(caregivers.count / limit)
      });
    }

    // Add rating statistics for regular response
    const caregiversWithRatings = await Promise.all(
      caregivers.rows.map(async (caregiver) => {
        const ratingStats = await Appointment.findAll({
          where: {
            caregiverId: caregiver.id,
            patient_rating: { [Op.not]: null }
          },
          attributes: [
            [sequelize.fn('AVG', sequelize.col('patient_rating')), 'averageRating'],
            [sequelize.fn('COUNT', sequelize.col('patient_rating')), 'totalRatings']
          ],
          raw: true
        });
        
        return {
          ...caregiver.toJSON(),
          averageRating: ratingStats[0]?.averageRating ? parseFloat(ratingStats[0].averageRating).toFixed(1) : null,
          totalRatings: parseInt(ratingStats[0]?.totalRatings) || 0
        };
      })
    );

    res.json({
      caregivers: caregiversWithRatings,
      total: caregivers.count,
      page: parseInt(page),
      totalPages: Math.ceil(caregivers.count / limit)
    });
  } catch (error) {
    next(error);
  }
};

const getCaregiverById = async (req, res, next) => {
  try {
    const caregiver = await Caregiver.findByPk(req.params.id, {
      where: {
        verificationStatus: 'APPROVED' // Only approved caregivers
      },
      include: [
        { 
          model: User,
          where: { isActive: true }, // Only active users
          required: true
        },
        { model: Specialty, through: { attributes: [] } }
      ]
    });

    if (!caregiver) {
      return res.status(404).json({ error: 'Caregiver not found' });
    }

    // Get rating statistics
    const ratingStats = await Appointment.findAll({
      where: {
        caregiverId: caregiver.id,
        patient_rating: { [Op.not]: null }
      },
      attributes: [
        [sequelize.fn('AVG', sequelize.col('patient_rating')), 'averageRating'],
        [sequelize.fn('COUNT', sequelize.col('patient_rating')), 'totalRatings']
      ],
      raw: true
    });

    const caregiverData = {
      ...caregiver.toJSON(),
      averageRating: ratingStats[0]?.averageRating ? parseFloat(ratingStats[0].averageRating).toFixed(1) : null,
      totalRatings: parseInt(ratingStats[0]?.totalRatings) || 0
    };

    res.json({ caregiver: caregiverData });
  } catch (error) {
    next(error);
  }
};

const getProfile = async (req, res, next) => {
  try {
    const caregiver = await Caregiver.findOne({ 
      where: { userId: req.user.id },
      include: [
        { model: User },
        { model: Specialty, through: { attributes: [] } }
      ]
    });

    if (!caregiver) {
      return res.status(404).json({ error: 'Caregiver profile not found' });
    }

    res.json({ caregiver });
  } catch (error) {
    next(error);
  }
};

const updateProfile = async (req, res, next) => {
  try {
    const caregiver = await Caregiver.findOne({ where: { userId: req.user.id } });

    if (!caregiver) {
      return res.status(404).json({ error: 'Caregiver profile not found' });
    }

    const { licenseNumber, yearsOfExperience, bio, hourlyRate, availability } = req.body;

    await caregiver.update({
      licenseNumber,
      yearsOfExperience,
      bio,
      hourlyRate,
      availability
    });

    const updatedCaregiver = await Caregiver.findByPk(caregiver.id, {
      include: [
        { model: User },
        { model: Specialty, through: { attributes: [] } }
      ]
    });

    res.json({ caregiver: updatedCaregiver });
  } catch (error) {
    next(error);
  }
};

const updateSpecialties = async (req, res, next) => {
  try {
    const caregiver = await Caregiver.findOne({ where: { userId: req.user.id } });

    if (!caregiver) {
      return res.status(404).json({ error: 'Caregiver profile not found' });
    }

    const { specialtyIds } = req.body;

    // Sync specialties (replaces existing with new ones)
    await caregiver.setSpecialties(specialtyIds);

    const updatedCaregiver = await Caregiver.findByPk(caregiver.id, {
      include: [
        { model: User },
        { model: Specialty, through: { attributes: [] } }
      ]
    });

    res.json({ caregiver: updatedCaregiver });
  } catch (error) {
    next(error);
  }
};

const getMyPatients = async (req, res, next) => {
  try {
    const caregiver = await Caregiver.findOne({ where: { userId: req.user.id } });
    if (!caregiver) {
      return res.status(404).json({ error: 'Caregiver profile not found' });
    }

    const appointments = await Appointment.findAll({
      where: { caregiverId: caregiver.id },
      include: [{
        model: Patient,
        include: [{ model: User, attributes: ['firstName', 'lastName', 'email', 'phone'] }]
      }]
    });

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
};

module.exports = {
  getCaregivers,
  getCaregiverById,
  getProfile,
  updateProfile,
  updateSpecialties,
  getMyPatients
};