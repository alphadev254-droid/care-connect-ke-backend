const { Caregiver, User, Specialty, TimeSlot, Patient, Appointment, sequelize } = require('../models');
const { VERIFICATION_STATUS, TIMESLOT_STATUS } = require('../utils/constants');
const { Op } = require('sequelize');

const asArray = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed;
      if (typeof parsed === 'string' && parsed !== value) return asArray(parsed);
      return parsed ? [parsed] : [];
    } catch {
      return [value];
    }
  }
  return [value];
};

const getVerificationResponse = async (userId) => {
  const updatedCaregiver = await findOwnCaregiver(userId);
  return {
    caregiver: updatedCaregiver,
    checklist: getVerificationChecklist(updatedCaregiver)
  };
};

const normalizeDocument = (document) => {
  if (!document) return null;
  if (typeof document === 'string') {
    const { getCloudinaryFileFromUrl, getMediaFileFromUrl } = require('../services/cloudinaryService');
    return {
      url: document,
      ...getCloudinaryFileFromUrl(document),
      ...getMediaFileFromUrl(document)
    };
  }
  if (document.url && !document.public_id) {
    const { getCloudinaryFileFromUrl, getMediaFileFromUrl } = require('../services/cloudinaryService');
    return {
      ...document,
      ...getCloudinaryFileFromUrl(document.url),
      ...getMediaFileFromUrl(document.url)
    };
  }
  return document;
};

const getFileResourceType = (document) => {
  if (document?.resource_type) return document.resource_type;
  if (document?.url?.includes('/raw/upload/')) return 'raw';
  if (document?.url?.includes('/image/upload/')) return 'image';
  return ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(String(document?.format || '').toLowerCase()) ? 'image' : 'raw';
};

const redirectToVerificationFile = async (res, document) => {
  const normalizedDocument = normalizeDocument(document);

  if (!normalizedDocument?.url && !normalizedDocument?.public_id) {
    return res.status(404).json({ error: 'Caregiver file not found' });
  }

  if (!normalizedDocument.public_id) {
    return res.redirect(normalizedDocument.url);
  }

  const { getSignedFileUrl, streamStoredFile } = require('../services/cloudinaryService');
  const resourceType = getFileResourceType(normalizedDocument);

  if (normalizedDocument.provider === 'media-server' || normalizedDocument.bucket || resourceType !== 'image') {
    return streamStoredFile(res, {
      ...normalizedDocument,
      public_id: normalizedDocument.public_id,
      resource_type: resourceType,
      format: normalizedDocument.format,
      filename: normalizedDocument.filename
    });
  }

  return res.redirect(getSignedFileUrl({
    public_id: normalizedDocument.public_id,
    resource_type: resourceType,
    format: normalizedDocument.format
  }));
};

const isAtLeast18 = (dateOfBirth) => {
  if (!dateOfBirth) return false;
  const birthDate = new Date(dateOfBirth);
  if (Number.isNaN(birthDate.getTime())) return false;

  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age -= 1;
  }

  return age >= 18;
};

const findOwnCaregiver = async (userId) => Caregiver.findOne({
  where: { userId },
  include: [
    { model: User },
    { model: Specialty, through: { attributes: [] } }
  ]
});

const getVerificationChecklist = (caregiver) => {
  const data = caregiver?.toJSON ? caregiver.toJSON() : caregiver;
  return {
    personal: Boolean(data?.User?.idNumber && isAtLeast18(data?.dateOfBirth)),
    professional: Boolean(
      data?.licensingInstitution &&
      data?.licenseNumber &&
      !String(data.licenseNumber).startsWith('TEMP-') &&
      Number(data?.experience) > 0 &&
      data?.qualifications &&
      data.qualifications !== 'To be updated' &&
      (data?.Specialties || []).length > 0
    ),
    location: Boolean(
      data?.region &&
      data?.district &&
      asArray(data?.traditionalAuthority).length > 0 &&
      asArray(data?.village).length > 0
    ),
    files: Boolean(
      data?.profileImage &&
      asArray(data?.idDocuments).length > 0 &&
      asArray(data?.supportingDocuments).length > 0
    )
  };
};

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

const getVerificationProfile = async (req, res, next) => {
  try {
    const caregiver = await findOwnCaregiver(req.user.id);

    if (!caregiver) {
      return res.status(404).json({ error: 'Caregiver profile not found' });
    }

    res.json({
      caregiver,
      checklist: getVerificationChecklist(caregiver)
    });
  } catch (error) {
    next(error);
  }
};

const updateVerificationProfile = async (req, res, next) => {
  try {
    const caregiver = await Caregiver.findOne({ where: { userId: req.user.id } });

    if (!caregiver) {
      return res.status(404).json({ error: 'Caregiver profile not found' });
    }

    const {
      idNumber,
      dateOfBirth,
      licensingInstitution,
      licenseNumber,
      experience,
      qualifications,
      region,
      district,
      traditionalAuthority,
      village,
      specialtyIds
    } = req.body;

    const userUpdates = {};
    if (idNumber !== undefined) userUpdates.idNumber = idNumber;
    if (Object.keys(userUpdates).length > 0) {
      await User.update(userUpdates, { where: { id: req.user.id } });
    }

    const caregiverUpdates = {};
    if (licensingInstitution !== undefined) caregiverUpdates.licensingInstitution = licensingInstitution;
    if (dateOfBirth !== undefined) caregiverUpdates.dateOfBirth = dateOfBirth || null;
    if (dateOfBirth !== undefined && dateOfBirth && !isAtLeast18(dateOfBirth)) {
      return res.status(400).json({ error: 'Caregiver must be at least 18 years old' });
    }
    if (licenseNumber !== undefined) caregiverUpdates.licenseNumber = licenseNumber || `TEMP-${caregiver.id}`;
    if (experience !== undefined) caregiverUpdates.experience = parseInt(experience, 10) || 0;
    if (qualifications !== undefined) caregiverUpdates.qualifications = qualifications || 'To be updated';
    if (region !== undefined) caregiverUpdates.region = region;
    if (district !== undefined) caregiverUpdates.district = district;
    if (traditionalAuthority !== undefined) caregiverUpdates.traditionalAuthority = asArray(traditionalAuthority);
    if (village !== undefined) caregiverUpdates.village = asArray(village);
    if (Object.keys(caregiverUpdates).length > 0) {
      await caregiver.update(caregiverUpdates);
    }

    if (specialtyIds !== undefined) {
      await caregiver.setSpecialties(asArray(specialtyIds));
    }

    const updatedCaregiver = await findOwnCaregiver(req.user.id);
    res.json({
      caregiver: updatedCaregiver,
      checklist: getVerificationChecklist(updatedCaregiver)
    });
  } catch (error) {
    next(error);
  }
};

const uploadVerificationFile = async (req, res, next) => {
  try {
    const caregiver = await Caregiver.findOne({ where: { userId: req.user.id } });

    if (!caregiver) {
      return res.status(404).json({ error: 'Caregiver profile not found' });
    }

    const files = req.files || {};
    const { uploadToCloudinary } = require('../services/cloudinaryService');
    const updates = {};

    if (files.profilePicture?.[0] || files.profileImage?.[0]) {
      const file = files.profilePicture?.[0] || files.profileImage?.[0];
      const uploadResult = await uploadToCloudinary(file, 'caregiver-profiles');
      updates.profileImage = uploadResult.url;
    }

    if (files.idDocuments?.length) {
      const existing = asArray(caregiver.idDocuments);
      const uploaded = [];
      for (const file of files.idDocuments.slice(0, Math.max(0, 2 - existing.length))) {
        const uploadResult = await uploadToCloudinary(file, 'caregiver-ids');
        uploaded.push({
          url: uploadResult.url,
          public_id: uploadResult.public_id,
          id: uploadResult.id,
          bucket: uploadResult.bucket,
          key: uploadResult.key,
          filename: file.originalname,
          format: uploadResult.format,
          resource_type: uploadResult.resource_type,
          mime: uploadResult.mime,
          size: uploadResult.size,
          provider: uploadResult.provider
        });
      }
      updates.idDocuments = [...existing, ...uploaded].slice(0, 2);
    }

    if (files.supportingDocuments?.length) {
      const existing = asArray(caregiver.supportingDocuments);
      const uploaded = [];
      for (const file of files.supportingDocuments.slice(0, Math.max(0, 5 - existing.length))) {
        const uploadResult = await uploadToCloudinary(file, 'caregiver-documents');
        uploaded.push({
          url: uploadResult.url,
          public_id: uploadResult.public_id,
          id: uploadResult.id,
          bucket: uploadResult.bucket,
          key: uploadResult.key,
          filename: file.originalname,
          format: uploadResult.format,
          resource_type: uploadResult.resource_type,
          mime: uploadResult.mime,
          size: uploadResult.size,
          provider: uploadResult.provider
        });
      }
      updates.supportingDocuments = [...existing, ...uploaded].slice(0, 5);
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No verification file provided' });
    }

    await caregiver.update(updates);

    res.json(await getVerificationResponse(req.user.id));
  } catch (error) {
    next(error);
  }
};

const deleteVerificationFile = async (req, res, next) => {
  try {
    const caregiver = await Caregiver.findOne({ where: { userId: req.user.id } });

    if (!caregiver) {
      return res.status(404).json({ error: 'Caregiver profile not found' });
    }

    const { field, index } = req.body;
    const updates = {};

    if (field === 'profilePicture' || field === 'profileImage') {
      updates.profileImage = null;
    } else if (field === 'idDocuments' || field === 'supportingDocuments') {
      const documents = asArray(caregiver[field]);
      const documentIndex = Number(index);

      if (!Number.isInteger(documentIndex) || documentIndex < 0 || documentIndex >= documents.length) {
        return res.status(400).json({ error: 'Invalid document index' });
      }

      updates[field] = documents.filter((_, currentIndex) => currentIndex !== documentIndex);
    } else {
      return res.status(400).json({ error: 'Invalid verification file field' });
    }

    await caregiver.update(updates);
    res.json(await getVerificationResponse(req.user.id));
  } catch (error) {
    next(error);
  }
};

const viewVerificationFile = async (req, res, next) => {
  try {
    const caregiver = await Caregiver.findOne({ where: { userId: req.user.id } });

    if (!caregiver) {
      return res.status(404).json({ error: 'Caregiver profile not found' });
    }

    const { field, index } = req.params;

    if (field === 'profilePicture' || field === 'profileImage') {
      return await redirectToVerificationFile(res, caregiver.profileImage);
    }

    if (field !== 'idDocuments' && field !== 'supportingDocuments') {
      return res.status(400).json({ error: 'Invalid file field' });
    }

    const documents = asArray(caregiver[field]);
    const documentIndex = Number(index);

    if (!Number.isInteger(documentIndex) || documentIndex < 0 || documentIndex >= documents.length) {
      return res.status(404).json({ error: 'Caregiver file not found' });
    }

    return await redirectToVerificationFile(res, documents[documentIndex]);
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
  getVerificationProfile,
  updateVerificationProfile,
  uploadVerificationFile,
  deleteVerificationFile,
  viewVerificationFile,
  getMyPatients
};
