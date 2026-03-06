const { Specialty, Appointment, PaymentTransaction, Caregiver, User } = require('../models');
const { Op } = require('sequelize');
const sequelize = require('../config/database');
const paymentConfig = require('../config/payment');

// Get all specialties (including inactive for admin)
const getSpecialties = async (req, res, next) => {
  try {
    const { includeInactive } = req.query;
    const whereClause = {};

    // Only show active specialties unless specifically requested
    if (includeInactive !== 'true') {
      whereClause.isActive = true;
    }

    const specialties = await Specialty.findAll({
      where: whereClause,
      attributes: [
        'id',
        'name',
        'description',
        'sessionFee',
        'bookingFee',
        'isActive',
        'createdAt',
        'updatedAt',
        [
          sequelize.literal(`(
            SELECT COUNT(*) FROM appointments a
            WHERE a.specialtyId = Specialty.id
            AND a.status IN ('session_attended', 'completed')
          )`),
          'completedAppointments'
        ],
        [
          sequelize.literal(`(
            SELECT COALESCE(
              SUM(
                CASE WHEN a.booking_fee_status = 'completed' THEN a.bookingFee ELSE 0 END +
                CASE WHEN a.session_fee_status = 'completed' THEN a.sessionFee ELSE 0 END
              ), 0
            ) FROM appointments a
            WHERE a.specialtyId = Specialty.id
          )`),
          'totalIncome'
        ],
        [
          sequelize.literal(`(
            SELECT COUNT(DISTINCT c.id) FROM caregivers c
            JOIN caregiverspecialties cs ON c.id = cs.CaregiverId
            WHERE cs.SpecialtyId = Specialty.id
          )`),
          'activeCaregiversCount'
        ]
      ],
      order: [['name', 'ASC']]
    });

    // Add convenience fee percentage and tax rate to all specialties
    const specialtiesWithConvenience = specialties.map(s => ({
      ...s.toJSON(),
      convenienceFeePercentage: paymentConfig.paychangu.convenienceFeePercentage,
      taxRate: paymentConfig.paychangu.taxRate
    }));

    res.json({
      success: true,
      specialties: specialtiesWithConvenience
    });
  } catch (error) {
    next(error);
  }
};

// Get specialty by ID
const getSpecialtyById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const specialty = await Specialty.findByPk(id);

    if (!specialty) {
      return res.status(404).json({
        success: false,
        error: 'Specialty not found'
      });
    }

    // Add convenience fee percentage and tax rate from payment config
    const paymentConfig = require('../config/payment');
    const specialtyWithConvenience = {
      ...specialty.toJSON(),
      convenienceFeePercentage: paymentConfig.paychangu.convenienceFeePercentage,
      taxRate: paymentConfig.paychangu.taxRate
    };

    res.json({
      success: true,
      specialty: specialtyWithConvenience
    });
  } catch (error) {
    next(error);
  }
};

// Create new specialty (Admin only)
const createSpecialty = async (req, res, next) => {
  try {
    const { name, description, sessionFee, bookingFee, isActive } = req.body;

    // Validate required fields
    if (!name) {
      return res.status(400).json({
        success: false,
        error: 'Specialty name is required'
      });
    }

    // Check if specialty already exists
    const existingSpecialty = await Specialty.findOne({ where: { name } });
    if (existingSpecialty) {
      return res.status(400).json({
        success: false,
        error: 'Specialty with this name already exists'
      });
    }

    const specialty = await Specialty.create({
      name,
      description,
      sessionFee: sessionFee || 0,
      bookingFee: bookingFee || 0,
      isActive: isActive !== undefined ? isActive : true
    });

    res.status(201).json({
      success: true,
      message: 'Specialty created successfully',
      specialty
    });
  } catch (error) {
    next(error);
  }
};

// Update specialty (Admin only)
const updateSpecialty = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, description, sessionFee, bookingFee, isActive } = req.body;

    const specialty = await Specialty.findByPk(id);

    if (!specialty) {
      return res.status(404).json({
        success: false,
        error: 'Specialty not found'
      });
    }

    // Check if new name conflicts with existing specialty
    if (name && name !== specialty.name) {
      const existingSpecialty = await Specialty.findOne({ where: { name } });
      if (existingSpecialty) {
        return res.status(400).json({
          success: false,
          error: 'Specialty with this name already exists'
        });
      }
    }

    // Update fields
    await specialty.update({
      name: name || specialty.name,
      description: description !== undefined ? description : specialty.description,
      sessionFee: sessionFee !== undefined ? sessionFee : specialty.sessionFee,
      bookingFee: bookingFee !== undefined ? bookingFee : specialty.bookingFee,
      isActive: isActive !== undefined ? isActive : specialty.isActive
    });

    res.json({
      success: true,
      message: 'Specialty updated successfully',
      specialty
    });
  } catch (error) {
    next(error);
  }
};

// Delete specialty (Admin only) - Soft delete
const deleteSpecialty = async (req, res, next) => {
  try {
    const { id } = req.params;

    const specialty = await Specialty.findByPk(id);

    if (!specialty) {
      return res.status(404).json({
        success: false,
        error: 'Specialty not found'
      });
    }

    // Soft delete by setting isActive to false
    await specialty.update({ isActive: false });

    res.json({
      success: true,
      message: 'Specialty deactivated successfully'
    });
  } catch (error) {
    next(error);
  }
};

// Restore specialty (Admin only)
const restoreSpecialty = async (req, res, next) => {
  try {
    const { id } = req.params;

    const specialty = await Specialty.findByPk(id);

    if (!specialty) {
      return res.status(404).json({
        success: false,
        error: 'Specialty not found'
      });
    }

    await specialty.update({ isActive: true });

    res.json({
      success: true,
      message: 'Specialty restored successfully',
      specialty
    });
  } catch (error) {
    next(error);
  }
};

// Update specialty fees (Admin only)
const updateSpecialtyFees = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { sessionFee, bookingFee } = req.body;

    const specialty = await Specialty.findByPk(id);

    if (!specialty) {
      return res.status(404).json({
        success: false,
        error: 'Specialty not found'
      });
    }

    // Validate fees
    if (sessionFee !== undefined && sessionFee < 0) {
      return res.status(400).json({
        success: false,
        error: 'Session fee cannot be negative'
      });
    }

    if (bookingFee !== undefined && bookingFee < 0) {
      return res.status(400).json({
        success: false,
        error: 'Booking fee cannot be negative'
      });
    }

    await specialty.update({
      sessionFee: sessionFee !== undefined ? sessionFee : specialty.sessionFee,
      bookingFee: bookingFee !== undefined ? bookingFee : specialty.bookingFee
    });

    res.json({
      success: true,
      message: 'Specialty fees updated successfully',
      specialty
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getSpecialties,
  getSpecialtyById,
  createSpecialty,
  updateSpecialty,
  deleteSpecialty,
  restoreSpecialty,
  updateSpecialtyFees
};