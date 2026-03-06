const { User, Patient, Caregiver, PrimaryPhysician, Role, UserSettings } = require('../models');
const { sanitizeUser } = require('../utils/helpers');

const getProfile = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.user.id, {
      include: [
        { model: Role, attributes: ['name'] },
        { 
          model: Patient, 
          required: false,
          attributes: {
            exclude: ['medicalHistory', 'currentMedications', 'allergies'] // Remove medical info
          }
        },
        { 
          model: Caregiver, 
          required: false,
          attributes: {
            include: ['profileImage', 'idDocuments', 'supportingDocuments'] // Include file fields
          }
        },
        { model: PrimaryPhysician, required: false }
      ]
    });

    res.json({ user: sanitizeUser(user) });
  } catch (error) {
    next(error);
  }
};

const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    const user = await User.findByPk(req.user.id);
    
    // Verify current password
    const bcrypt = require('bcryptjs');
    const isValidPassword = await bcrypt.compare(currentPassword, user.password);
    if (!isValidPassword) {
      return res.status(400).json({ error: 'Current password is incorrect' });
    }
    
    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    // Update password
    await user.update({ password: hashedPassword });
    
    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    next(error);
  }
};

const updateProfile = async (req, res, next) => {
  try {
    const { 
      firstName, 
      lastName, 
      phone, 
      dateOfBirth,
      address,
      emergencyContact,
      bio,
      region,
      district,
      traditionalAuthority,
      village,
      ...otherData 
    } = req.body;
    const uploadedFiles = req.files || {};
    
    const user = await User.findByPk(req.user.id, {
      include: [
        { model: Role, attributes: ['name'] },
        { model: Patient, required: false },
        { model: Caregiver, required: false },
        { model: PrimaryPhysician, required: false }
      ]
    });
    
    // Update user basic info
    await user.update({
      firstName,
      lastName,
      phone
    });

    // Update patient-specific data
    if (user.Role.name === 'patient' && user.Patient) {
      const patientData = {};
      if (dateOfBirth) patientData.dateOfBirth = dateOfBirth;
      if (address) patientData.address = address;
      if (emergencyContact) patientData.emergencyContact = emergencyContact;
      
      await user.Patient.update(patientData);
    }

    // Update caregiver-specific data
    if (user.Role.name === 'caregiver' && user.Caregiver) {
      const caregiverData = {};
      if (bio !== undefined) caregiverData.bio = bio;
      if (region) caregiverData.region = region;
      if (district) caregiverData.district = district;
      if (traditionalAuthority) caregiverData.traditionalAuthority = traditionalAuthority;
      if (village) caregiverData.village = village;
      
      await user.Caregiver.update(caregiverData);
      
      // Handle profile image upload
      if (uploadedFiles.profileImage) {
        try {
          const { uploadToCloudinary } = require('../services/cloudinaryService');
          const uploadResult = await uploadToCloudinary(uploadedFiles.profileImage[0], 'caregiver-profiles');
          await user.Caregiver.update({
            profileImage: uploadResult.url
          });
        } catch (uploadError) {
          console.error('Profile image upload failed:', uploadError);
        }
      }
    }

    // Fetch updated user with all associations
    const updatedUser = await User.findByPk(req.user.id, {
      include: [
        { model: Role, attributes: ['name'] },
        { 
          model: Patient, 
          required: false,
          attributes: {
            exclude: ['medicalHistory', 'currentMedications', 'allergies']
          }
        },
        { 
          model: Caregiver, 
          required: false,
          attributes: {
            include: ['profileImage', 'idDocuments', 'supportingDocuments']
          }
        },
        { model: PrimaryPhysician, required: false }
      ]
    });

    res.json({ user: sanitizeUser(updatedUser) });
  } catch (error) {
    next(error);
  }
};

const getSettings = async (req, res, next) => {
  try {
    let settings = await UserSettings.findOne({ where: { userId: req.user.id } });
    
    if (!settings) {
      settings = await UserSettings.create({ userId: req.user.id });
    }
    
    res.json({ settings });
  } catch (error) {
    next(error);
  }
};

const updateSettings = async (req, res, next) => {
  try {
    const { notifications, privacy, preferences } = req.body;
    
    let settings = await UserSettings.findOne({ where: { userId: req.user.id } });
    
    if (!settings) {
      settings = await UserSettings.create({ 
        userId: req.user.id,
        notifications,
        privacy,
        preferences
      });
    } else {
      await settings.update({
        notifications,
        privacy,
        preferences
      });
    }
    
    res.json({ settings, message: 'Settings updated successfully' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getProfile,
  updateProfile,
  changePassword,
  getSettings,
  updateSettings
};