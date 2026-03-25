const { Caregiver, User, Specialty, TimeSlot, Patient, Appointment, sequelize } = require('../models');
const { VERIFICATION_STATUS, TIMESLOT_STATUS } = require('../utils/constants');
const { Op } = require('sequelize');

const getCaregivers = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, specialtyId, verified = true, includeAvailability } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = {};
    let userWhereClause = { isActive: true };
    if (verified === 'true') whereClause.verificationStatus = 'verified';

    let includeClause = [
      { model: User, where: userWhereClause, required: true },
      { model: Specialty, through: { attributes: [] } }
    ];
    if (specialtyId) includeClause[1].where = { id: specialtyId };

    const caregivers = await Caregiver.findAndCountAll({
      where: whereClause,
      include: includeClause,
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['createdAt', 'DESC']]
    });

    const ids = caregivers.rows.map(c => c.id);

    // Single bulk ratings query for all caregivers
    const allRatings = ids.length ? await Appointment.findAll({
      where: { caregiverId: { [Op.in]: ids }, patient_rating: { [Op.not]: null } },
      attributes: [
        'caregiverId',
        [sequelize.fn('AVG', sequelize.col('patient_rating')), 'averageRating'],
        [sequelize.fn('COUNT', sequelize.col('patient_rating')), 'totalRatings']
      ],
      group: ['caregiverId'],
      raw: true
    }) : [];
    const ratingsMap = {};
    allRatings.forEach(r => { ratingsMap[r.caregiverId] = r; });

    if (includeAvailability === 'true') {
      // Single bulk slots count query for all caregivers
      const today = new Date().toISOString().split('T')[0];
      const allSlots = ids.length ? await TimeSlot.findAll({
        where: { caregiverId: { [Op.in]: ids }, status: TIMESLOT_STATUS.AVAILABLE, date: { [Op.gte]: today } },
        attributes: ['caregiverId', [sequelize.fn('COUNT', sequelize.col('id')), 'slotCount']],
        group: ['caregiverId'],
        raw: true
      }) : [];
      const slotsMap = {};
      allSlots.forEach(s => { slotsMap[s.caregiverId] = parseInt(s.slotCount) || 0; });

      return res.json({
        caregivers: caregivers.rows.map(c => {
          const r = ratingsMap[c.id];
          const count = slotsMap[c.id] || 0;
          return {
            ...c.toJSON(),
            hasAvailableSlots: count > 0,
            availableSlotsCount: count,
            averageRating: r?.averageRating ? parseFloat(r.averageRating).toFixed(1) : null,
            totalRatings: parseInt(r?.totalRatings) || 0
          };
        }),
        total: caregivers.count,
        page: parseInt(page),
        totalPages: Math.ceil(caregivers.count / limit)
      });
    }

    res.json({
      caregivers: caregivers.rows.map(c => {
        const r = ratingsMap[c.id];
        return {
          ...c.toJSON(),
          averageRating: r?.averageRating ? parseFloat(r.averageRating).toFixed(1) : null,
          totalRatings: parseInt(r?.totalRatings) || 0
        };
      }),
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
        verificationStatus: 'verified'
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