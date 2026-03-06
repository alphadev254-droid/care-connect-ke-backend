const express = require('express');
const { sanitizeUser } = require('../utils/helpers');
const { Op, sequelize } = require('sequelize');

const router = express.Router();

// Get specialties with caregiver counts
router.get('/specialties', async (req, res, next) => {
  try {
    const { Specialty, Caregiver, User, Role, Appointment, sequelize } = require('../models');

    const specialties = await Specialty.findAll({
      attributes: [
        'id',
        'name',
        'description',
        [
          sequelize.literal(`(
            SELECT COUNT(DISTINCT c.id)
            FROM caregivers c
            INNER JOIN caregiverspecialties cs ON c.id = cs.caregiverId
            INNER JOIN users u ON c.userId = u.id
            WHERE cs.specialtyId = Specialty.id
            AND c.verificationStatus = 'APPROVED'
            AND u.isActive = 1
          )`),
          'caregiverCount'
        ]
      ],
      order: [['name', 'ASC']]
    });

    // Get total approved caregivers
    const caregiverRole = await Role.findOne({ where: { name: 'caregiver' } });
    const totalCaregivers = await User.count({
      where: { role_id: caregiverRole.id, isActive: true },
      include: [{
        model: Caregiver,
        required: true,
        where: { verificationStatus: 'APPROVED' }
      }]
    });

    // Get average rating
    const ratingStats = await Appointment.findAll({
      where: { patient_rating: { [Op.not]: null } },
      attributes: [
        [sequelize.fn('AVG', sequelize.col('patient_rating')), 'averageRating']
      ],
      raw: true
    });

    res.json({
      success: true,
      specialties: specialties.map(s => ({
        id: s.id,
        name: s.name,
        description: s.description,
        caregiverCount: parseInt(s.dataValues.caregiverCount) || 0
      })),
      stats: {
        totalCaregivers,
        averageRating: ratingStats[0]?.averageRating ? parseFloat(ratingStats[0].averageRating).toFixed(1) : '4.9'
      }
    });
  } catch (error) {
    next(error);
  }
});

// Get active caregivers (all verification statuses)
router.get('/caregivers', async (req, res, next) => {
  try {
    const { User, Role, Caregiver, Specialty, sequelize } = require('../models');
    const { page = 1, limit = 100, specialtyId, region, district, traditionalAuthority, village, search } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const caregiverRole = await Role.findOne({ where: { name: 'caregiver' } });

    // Build where clause for User
    let userWhereClause = {
      role_id: caregiverRole.id,
      isActive: true
    };

    // Add search functionality
    if (search) {
      userWhereClause[Op.or] = [
        { firstName: { [Op.like]: `%${search}%` } },
        { lastName: { [Op.like]: `%${search}%` } },
        { phone: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } },
        sequelize.where(
          sequelize.fn('CONCAT', sequelize.col('firstName'), ' ', sequelize.col('lastName')),
          { [Op.like]: `%${search}%` }
        )
      ];
    }

    // Build where clause for Caregiver (location filters + verification status)
    let caregiverWhereClause = {
      verificationStatus: 'APPROVED' // Only show approved caregivers to public
    };

    if (region) {
      caregiverWhereClause.region = region;
    }

    if (district) {
      caregiverWhereClause.district = district;
    }

    if (traditionalAuthority) {
      // Check if the JSON array contains the value
      caregiverWhereClause.traditionalAuthority = {
        [Op.like]: `%"${traditionalAuthority}"%`
      };
    }

    if (village) {
      // Check if the JSON array contains the value
      caregiverWhereClause.village = {
        [Op.like]: `%"${village}"%`
      };
    }

    // Build Specialty include with optional filtering
    let specialtyInclude = {
      model: Specialty,
      through: {
        attributes: [] // No additional attributes needed from pivot table
      },
      attributes: ['id', 'name', 'description', 'sessionFee', 'bookingFee']
    };

    // Filter by specialty if specified
    if (specialtyId) {
      specialtyInclude.where = { id: specialtyId };
      specialtyInclude.required = true; // Inner join to only get caregivers with this specialty
    }

    // Determine if Caregiver join should be required (INNER JOIN)
    // Required when: location filters are applied OR specialty filter is applied
    const hasLocationFilters = Object.keys(caregiverWhereClause).length > 0;
    const caregiverRequired = hasLocationFilters || specialtyId;

    const { count, rows: caregivers } = await User.findAndCountAll({
      where: userWhereClause,
      include: [
        {
          model: Caregiver,
          required: caregiverRequired,
          where: Object.keys(caregiverWhereClause).length > 0 ? caregiverWhereClause : undefined,
          attributes: [
            'id',
            'experience',
            'qualifications',
            'licensingInstitution',
            'verificationStatus',
            'bio',
            'profileImage',
            'appointmentDuration',
            'autoConfirm',
            'region',
            'district',
            'traditionalAuthority',
            'village',
            'referralBoostScore',
            'referralCount'
          ],
          include: [specialtyInclude]
        }
      ],
      attributes: ['id', 'firstName', 'lastName', 'email', 'phone'],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [
        // Primary sort: Referral boost score (highest first)
        [Caregiver, 'referralBoostScore', 'DESC'],
        // Secondary sort: Creation date (most recent first)
        ['createdAt', 'DESC']
      ],
      distinct: true,
      subQuery: false
    });

    // Return optimized data structure
    const formattedCaregivers = await Promise.all(caregivers.map(async (user) => {
      const userData = user.toJSON();
      
      // Add rating data if caregiver exists
      if (userData.Caregiver) {
        const { Appointment } = require('../models');
        const ratingStats = await Appointment.findAll({
          where: {
            caregiverId: userData.Caregiver.id,
            patient_rating: { [Op.not]: null }
          },
          attributes: [
            [sequelize.fn('AVG', sequelize.col('patient_rating')), 'averageRating'],
            [sequelize.fn('COUNT', sequelize.col('patient_rating')), 'totalRatings']
          ],
          raw: true
        });
        
        userData.Caregiver.averageRating = ratingStats[0]?.averageRating ? parseFloat(ratingStats[0].averageRating).toFixed(1) : null;
        userData.Caregiver.totalRatings = parseInt(ratingStats[0]?.totalRatings) || 0;
      }
      
      return userData;
    }));

    res.json({
      success: true,
      caregivers: formattedCaregivers,
      pagination: {
        total: count,
        page: parseInt(page),
        totalPages: Math.ceil(count / parseInt(limit))
      }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;