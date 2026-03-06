const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { User, Patient, Caregiver, PrimaryPhysician, Role, Referral, CaregiverAvailability } = require('../models');
const { jwtSecret, jwtExpiresIn, bcryptRounds } = require('../config/auth');
const { USER_ROLES } = require('../utils/constants');
const { sanitizeUser } = require('../utils/helpers');
const NotificationHelper = require('../utils/notificationHelper');
const { executeWithRetry } = require('../utils/databaseUtils');
const { asyncHandler } = require('../middleware/databaseErrorHandler');

const generateToken = (userId) => {
  return jwt.sign({ userId }, jwtSecret, { expiresIn: jwtExpiresIn });
};

const register = asyncHandler(async (req, res, next) => {
  const { email, password, firstName, lastName, phone, idNumber, role = 'patient', referralCode, ...roleSpecificData } = req.body;
  const uploadedFiles = req.files || {};

  console.log('📝 Registration data received:', {
    email,
    role,
    referralCode: referralCode || 'NOT PROVIDED',
    hasFiles: Object.keys(uploadedFiles).length > 0
  });

  // Pre-checks before opening any transaction — return HTTP responses directly to avoid
  // unhandled rejection crashes caused by throwing inside executeWithRetry's catch block.
  const userRole = await Role.findOne({ where: { name: role } });
  if (!userRole) {
    return res.status(400).json({ error: 'Invalid role specified' });
  }

  const existingUser = await User.findOne({ where: { email } });
  if (existingUser) {
    return res.status(409).json({ error: 'Email already registered' });
  }

  const result = await executeWithRetry(async (transaction) => {
    const hashedPassword = await bcrypt.hash(password, bcryptRounds);
    
    const user = await User.create({
      email,
      password: hashedPassword,
      firstName,
      lastName,
      phone,
      idNumber,
      role_id: userRole.id,
      isActive: true // All users start active, verification is separate for caregivers
    }, { transaction });

    // Get the user ID from the database since Sequelize isn't returning it properly
    const createdUser = await User.findOne({ 
      where: { email },
      transaction 
    });
    
    console.log('User created:', { id: createdUser?.id, email: createdUser?.email });

    // Ensure user was created and has an ID
    if (!createdUser || !createdUser.id) {
      console.error('User creation failed - no ID');
      throw new Error('Failed to create user');
    }

    // Create role-specific profile
    switch (role) {
      case 'patient':
        const patientData = {
          userId: parseInt(createdUser.id),
          dateOfBirth: roleSpecificData.dateOfBirth,
          address: roleSpecificData.address,
          emergencyContact: roleSpecificData.emergencyContact,
          medicalHistory: roleSpecificData.medicalHistory,
          currentMedications: roleSpecificData.currentMedications,
          allergies: roleSpecificData.allergies,
          region: roleSpecificData.region,
          district: roleSpecificData.district,
          traditionalAuthority: roleSpecificData.traditionalAuthority,
          village: roleSpecificData.village,
          patientType: roleSpecificData.patientType === 'child_patient' ? 'child' : 
                      roleSpecificData.patientType === 'elderly_patient' ? 'elderly' : 'adult',
          guardianFirstName: roleSpecificData.guardianFirstName,
          guardianLastName: roleSpecificData.guardianLastName,
          guardianPhone: roleSpecificData.guardianPhone,
          guardianEmail: roleSpecificData.guardianEmail,
          guardianRelationship: roleSpecificData.guardianRelationship,
          guardianIdNumber: roleSpecificData.guardianIdNumber
        };
        
        console.log('Creating patient with userId:', patientData.userId);
        const createdPatient = await Patient.create(patientData, { transaction });

        // Handle referral code if provided
        if (referralCode) {
          console.log(`🎫 Processing referral code: ${referralCode}`);
          console.log(`🔍 Searching for referral with code: ${referralCode.toUpperCase()}, status: pending`);
          try {
            const referral = await Referral.findOne({
              where: {
                referralCode: referralCode.toUpperCase(),
                status: 'pending'
              },
              transaction
            });

            console.log(`🔍 Referral found:`, referral ? `Yes (ID: ${referral.id}, Caregiver: ${referral.caregiverId}, Code: ${referral.referralCode})` : 'No');

            if (referral) {
              // Update referral with patient info
              await referral.update({
                patientId: createdPatient.id,
                referralType: 'patient',
                status: 'converted',
                convertedAt: new Date()
              }, { transaction });

              console.log(`✅ Referral updated: ID ${referral.id}, patientId: ${createdPatient.id}, status: converted`);

              // Increment caregiver boost score
              const incrementResult = await Caregiver.increment(
                {
                  referralBoostScore: 1,
                  referralCount: 1
                },
                {
                  where: { id: referral.caregiverId },
                  transaction
                }
              );

              console.log(`✅ Caregiver boost incremented for caregiver ${referral.caregiverId}`);
              console.log(`🎯 Referral fully converted: ${referralCode} → Patient ${createdPatient.id} → Caregiver ${referral.caregiverId}`);

              // Notify referring caregiver (non-blocking)
              setImmediate(async () => {
                try {
                  await NotificationHelper.notifyReferralConversion(
                    referral.caregiverId,
                    `${firstName} ${lastName}`
                  );
                } catch (notifError) {
                  console.error('Failed to send referral notification:', notifError);
                }
              });
            } else {
              console.log(`Referral code ${referralCode} not found or already used`);
            }
          } catch (referralError) {
            console.error('Error processing referral code:', referralError);
            // Don't fail registration if referral processing fails
          }
        }
        break;
      case 'caregiver':
        // Handle document uploads for caregivers
        let documentUrls = [];
        let profilePictureUrl = null;
        let idDocumentUrls = [];
        
        if (Object.keys(uploadedFiles).length > 0) {
          const { uploadToCloudinary } = require('../services/cloudinaryService');
          
          // Handle supporting documents (max 5)
          if (uploadedFiles.supportingDocuments) {
            for (const file of uploadedFiles.supportingDocuments.slice(0, 5)) {
              try {
                const uploadResult = await uploadToCloudinary(file, 'caregiver-documents');
                documentUrls.push({
                  url: uploadResult.url,
                  public_id: uploadResult.public_id,
                  filename: file.originalname,
                  format: uploadResult.format
                });
              } catch (uploadError) {
                console.error('Supporting document upload failed:', uploadError);
              }
            }
          }
          
          // Handle profile picture (single file)
          if (uploadedFiles.profilePicture && uploadedFiles.profilePicture[0]) {
            try {
              const uploadResult = await uploadToCloudinary(uploadedFiles.profilePicture[0], 'caregiver-profiles');
              profilePictureUrl = uploadResult.url; // Store just the URL string
            } catch (uploadError) {
              console.error('Profile picture upload failed:', uploadError);
            }
          }
          
          // Handle ID documents (max 3)
          if (uploadedFiles.idDocuments) {
            for (const file of uploadedFiles.idDocuments.slice(0, 3)) {
              try {
                const uploadResult = await uploadToCloudinary(file, 'caregiver-ids');
                idDocumentUrls.push({
                  url: uploadResult.url,
                  public_id: uploadResult.public_id,
                  filename: file.originalname,
                  format: uploadResult.format
                });
              } catch (uploadError) {
                console.error('ID document upload failed:', uploadError);
              }
            }
          }
        }
        
        const caregiver = await Caregiver.create({
          userId: createdUser.id,
          licensingInstitution: roleSpecificData.licensingInstitution,
          licenseNumber: roleSpecificData.licenseNumber || `TEMP-${Date.now()}`,
          experience: roleSpecificData.experience || 0,
          qualifications: roleSpecificData.qualifications || 'To be updated',
          hourlyRate: roleSpecificData.hourlyRate || 50.00,
          appointmentDuration: parseInt(process.env.DEFAULT_APPOINTMENT_DURATION) || 180,
          supportingDocuments: documentUrls.length > 0 ? documentUrls : null,
          profileImage: profilePictureUrl,
          idDocuments: idDocumentUrls.length > 0 ? idDocumentUrls : null,
          bio: roleSpecificData.bio,
          region: roleSpecificData.region,
          district: roleSpecificData.district,
          traditionalAuthority: roleSpecificData.traditionalAuthority,
          village: roleSpecificData.village
        }, { transaction });
        
        // Handle specialties - get the created caregiver with ID
        const createdCaregiver = await Caregiver.findOne({
          where: { userId: createdUser.id },
          transaction
        });
        
        if (roleSpecificData.specialties && Array.isArray(roleSpecificData.specialties) && createdCaregiver) {
          const specialtyIds = roleSpecificData.specialties.map(id => parseInt(id));
          await createdCaregiver.setSpecialties(specialtyIds, { transaction });
        }

        // Handle availability if provided during registration (transactional - failure rolls back everything)
        const availabilityRaw = req.body.availability;
        if (availabilityRaw && createdCaregiver) {
          const availabilitySlots = JSON.parse(availabilityRaw);
          if (Array.isArray(availabilitySlots) && availabilitySlots.length > 0) {
            await CaregiverAvailability.bulkCreate(
              availabilitySlots.map(slot => ({
                caregiverId: createdCaregiver.id,
                dayOfWeek: parseInt(slot.dayOfWeek),
                startTime: slot.startTime,
                endTime: slot.endTime,
                isActive: true
              })),
              { transaction }
            );
          }
        }

        // Handle referral code if provided (caregiver-to-caregiver referral)
        if (referralCode) {
          console.log(`🎫 Processing caregiver referral code: ${referralCode}`);
          console.log(`🔍 Searching for referral with code: ${referralCode.toUpperCase()}, status: pending`);
          try {
            const referral = await Referral.findOne({
              where: {
                referralCode: referralCode.toUpperCase(),
                status: 'pending'
              },
              transaction
            });

            console.log(`🔍 Referral found:`, referral ? `Yes (ID: ${referral.id}, Caregiver: ${referral.caregiverId}, Code: ${referral.referralCode})` : 'No');

            if (referral) {
              // Update referral with caregiver info
              await referral.update({
                referredCaregiverId: createdCaregiver.id,
                referralType: 'caregiver',
                status: 'converted',
                convertedAt: new Date()
              }, { transaction });

              console.log(`✅ Referral updated: ID ${referral.id}, referredCaregiverId: ${createdCaregiver.id}, type: caregiver, status: converted`);

              // Increment referring caregiver boost score
              const incrementResult = await Caregiver.increment(
                {
                  referralBoostScore: 1,
                  referralCount: 1
                },
                {
                  where: { id: referral.caregiverId },
                  transaction
                }
              );

              console.log(`✅ Caregiver boost incremented for referring caregiver ${referral.caregiverId}`);
              console.log(`🎯 Caregiver referral fully converted: ${referralCode} → Caregiver ${createdCaregiver.id} → Referring Caregiver ${referral.caregiverId}`);

              // Notify referring caregiver (non-blocking)
              setImmediate(async () => {
                try {
                  await NotificationHelper.notifyReferralConversion(
                    referral.caregiverId,
                    `${firstName} ${lastName} (Caregiver)`
                  );
                } catch (notifError) {
                  console.error('Failed to send caregiver referral notification:', notifError);
                }
              });
            } else {
              console.log(`Referral code ${referralCode} not found or already used`);
            }
          } catch (referralError) {
            console.error('Error processing caregiver referral code:', referralError);
            // Don't fail registration if referral processing fails
          }
        }
        break;
      case 'primary_physician':
        await PrimaryPhysician.create({
          userId: createdUser.id,
          ...roleSpecificData
        }, { transaction });
        break;
    }

    return { createdUser, role, roleSpecificData };
  });

  const { createdUser } = result;

  // Create notifications for new caregiver registration (async, non-blocking)
  if (role === 'caregiver') {
    setImmediate(async () => {
      try {
        await NotificationHelper.createCaregiverVerificationNotifications(
          createdUser.id,
          'PENDING',
          roleSpecificData.region
        );
      } catch (notificationError) {
        console.error('Failed to create caregiver registration notifications:', notificationError);
      }
    });

    // Auto-generate time slots for availability set during registration
    if (req.body.availability) {
      setImmediate(async () => {
        const MAX_RETRIES = 3;
        const RETRY_DELAY_MS = 3000;

        const generateSlots = async () => {
          const { TimeSlot } = require('../models');
          const { TIMESLOT_STATUS } = require('../utils/constants');

          const caregiver = await Caregiver.findOne({ where: { userId: createdUser.id } });
          if (!caregiver) throw new Error(`Caregiver not found for userId ${createdUser.id}`);

          const savedAvailability = await CaregiverAvailability.findAll({
            where: { caregiverId: caregiver.id }
          });
          if (!savedAvailability.length) return;

          const startDate = new Date().toISOString().split('T')[0];
          const endDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

          const allSlots = [];
          for (const availability of savedAvailability) {
            const start = new Date(startDate);
            const end = new Date(endDate);

            for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
              if (Number(availability.dayOfWeek) !== date.getDay()) continue;

              const slotStart = new Date(`${date.toDateString()} ${availability.startTime}`);
              const slotEnd = new Date(`${date.toDateString()} ${availability.endTime}`);

              while (slotStart < slotEnd) {
                const slotEndTime = new Date(slotStart.getTime() + caregiver.appointmentDuration * 60000);
                if (slotEndTime <= slotEnd) {
                  allSlots.push({
                    caregiverId: caregiver.id,
                    date: date.toISOString().split('T')[0],
                    startTime: slotStart.toTimeString().split(' ')[0],
                    endTime: slotEndTime.toTimeString().split(' ')[0],
                    duration: caregiver.appointmentDuration,
                    price: Math.round((caregiver.hourlyRate * caregiver.appointmentDuration) / 60),
                    status: TIMESLOT_STATUS.AVAILABLE,
                    availabilityId: availability.id
                  });
                }
                slotStart.setTime(slotStart.getTime() + caregiver.appointmentDuration * 60000);
              }
            }
          }

          if (allSlots.length > 0) {
            await TimeSlot.bulkCreate(allSlots, { ignoreDuplicates: true });
            console.log(`✅ Auto-generated ${allSlots.length} time slots for caregiver ${caregiver.id}`);
          }
        };

        const NotificationService = require('../services/notificationService');
        let succeeded = false;

        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
          try {
            await generateSlots();
            succeeded = true;
            break; // success - stop retrying
          } catch (err) {
            console.error(`Time slot generation attempt ${attempt}/${MAX_RETRIES} failed:`, err.message);
            if (attempt < MAX_RETRIES) {
              await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS * attempt));
            }
          }
        }

        try {
          if (succeeded) {
            await NotificationService.createNotification({
              userId: createdUser.id,
              title: 'Schedule Ready',
              message: 'Your availability has been saved and your time slots have been generated for the next 30 days. Patients can now book appointments with you.',
              type: 'system',
              priority: 'medium'
            });
          } else {
            console.warn(`⚠️ All ${MAX_RETRIES} slot generation attempts failed for caregiver userId ${createdUser.id}.`);
            await NotificationService.createNotification({
              userId: createdUser.id,
              title: 'Action Required: Generate Your Time Slots',
              message: 'Your availability was saved but we could not auto-generate your time slots. Please go to Schedule → Availability and click "Generate Slots" for each day to make yourself bookable.',
              type: 'system',
              priority: 'high'
            });
          }
        } catch (notifError) {
          console.error('Failed to send slot generation notification:', notifError.message);
        }
      });
    }
  }
  
  // Send data protection notification email for all registrations
  const EmailScheduler = require('../services/emailScheduler');
  await EmailScheduler.queueEmail(createdUser.email, 'data_protection_notification', {
    firstName: createdUser.firstName,
    lastName: createdUser.lastName,
    email: createdUser.email,
    role: role
  });
  
  // Send appropriate response based on role
  if (role === 'caregiver') {
    // Queue additional email notification to caregiver
    await EmailScheduler.queueEmail(createdUser.email, 'caregiver_registration', {
      email: createdUser.email,
      firstName: createdUser.firstName
    });
    
    res.status(201).json({
      message: 'Registration submitted. Please wait for admin approval.',
      requiresApproval: true
    });
  } else {
    const token = generateToken(createdUser.id);
    
    // Set HttpOnly cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000 // 1 day
    });
    
    res.status(201).json({
      message: 'Registration successful',
      user: sanitizeUser(createdUser)
    });
  }
});

const registerAdmin = async (req, res, next) => {
  const transaction = await User.sequelize.transaction();
  
  try {
    const { email, password, firstName, lastName, phone, roleName, ...roleSpecificData } = req.body;

    // Find the role
    const role = await Role.findOne({ where: { name: roleName } });
    if (!role) {
      await transaction.rollback();
      return res.status(400).json({ error: 'Invalid role specified' });
    }

    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      await transaction.rollback();
      return res.status(409).json({ error: 'Email already registered' });
    }

    const hashedPassword = await bcrypt.hash(password, bcryptRounds);
    
    const user = await User.create({
      email,
      password: hashedPassword,
      firstName,
      lastName,
      phone,
      role_id: role.id
    }, { transaction });

    // Create role-specific profile
    switch (roleName) {
      case 'caregiver':
        await Caregiver.create({
          userId: user.id,
          licenseNumber: roleSpecificData.licenseNumber || `TEMP-${Date.now()}`,
          experience: roleSpecificData.experience || 0,
          qualifications: roleSpecificData.qualifications || 'To be updated',
          hourlyRate: roleSpecificData.hourlyRate || 50.00,
          ...roleSpecificData
        }, { transaction });
        break;
      case 'primary_physician':
        await PrimaryPhysician.create({
          userId: user.id,
          ...roleSpecificData
        }, { transaction });
        break;
    }

    await transaction.commit();
    
    const token = generateToken(user.id);
    
    // Set HttpOnly cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000 // 1 day
    });
    
    res.status(201).json({
      message: 'Admin registration successful',
      user: sanitizeUser(user)
    });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};

const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const { Permission } = require('../models');

    console.log('🔐 Login attempt for:', email);

    const user = await User.findOne({ 
      where: { email },
      include: [{
        model: Role,
        include: [{
          model: Permission,
          through: { attributes: [] }
        }]
      }, {
        model: Caregiver,
        required: false
      }]
    });
    
    if (!user) {
      console.log('❌ User not found for email:', email);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (!user.isActive) {
      console.log('❌ User account is inactive:', email);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    console.log('✅ User found and active:', email);
    console.log('🔍 Stored password hash length:', user.password?.length);
    console.log('🔍 Input password length:', password?.length);

    // Additional validation for caregivers
    if (user.Role?.name === 'caregiver') {
      if (!user.Caregiver || user.Caregiver.verificationStatus !== 'APPROVED') {
        console.log('❌ Caregiver not verified:', email);
        return res.status(401).json({ 
          error: 'Account pending verification. Please wait for admin approval.' 
        });
      }
    }

    console.log('🔐 Comparing passwords...');
    const isValidPassword = await bcrypt.compare(password, user.password);
    console.log('🔍 Password comparison result:', isValidPassword);
    
    if (!isValidPassword) {
      console.log('❌ Password comparison failed for:', email);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    console.log('✅ Login successful for:', email);
    const token = generateToken(user.id);
    const sanitizedUser = sanitizeUser(user);
    
    // Add permissions to user object
    sanitizedUser.permissions = user.Role?.Permissions?.map(p => p.name) || [];
    
    // Set HttpOnly cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000 // 1 day
    });
    
    res.json({
      message: 'Login successful',
      user: sanitizedUser
    });
  } catch (error) {
    console.error('💥 Login error:', error);
    next(error);
  }
};

const getProfile = async (req, res, next) => {
  try {
    const { Permission } = require('../models');
    
    const user = await User.findByPk(req.user.id, {
      include: [
        { 
          model: Role, 
          attributes: ['name'],
          include: [{
            model: Permission,
            through: { attributes: [] }
          }]
        },
        { model: Patient, required: false },
        { model: Caregiver, required: false },
        { model: PrimaryPhysician, required: false }
      ]
    });

    const sanitizedUser = sanitizeUser(user);
    // Add permissions to user object
    sanitizedUser.permissions = user.Role?.Permissions?.map(p => p.name) || [];

    res.json({ user: sanitizedUser });
  } catch (error) {
    next(error);
  }
};

const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    console.log('🔐 Forgot password request for:', email);

    const user = await User.findOne({ where: { email } });
    if (!user) {
      console.log('⚠️ User not found for email:', email);
      // Don't reveal if email exists or not for security
      return res.json({ message: 'If the email exists, a reset link has been sent.' });
    }

    console.log('✅ User found:', user.firstName, user.lastName);

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hour from now

    console.log('🔑 Generated reset token:', resetToken.substring(0, 10) + '...');
    console.log('⏰ Token expires at:', resetTokenExpiry);

    // Save token to user
    await user.update({
      resetPasswordToken: resetToken,
      resetPasswordExpires: resetTokenExpiry
    });

    console.log('💾 Token saved to database');

    // Queue email with reset link using primary frontend URL
    const EmailScheduler = require('../services/emailScheduler');
    const { getPrimaryFrontendUrl } = require('../utils/config');
    const resetUrl = `${getPrimaryFrontendUrl()}/reset-password?token=${resetToken}`;
    
    await EmailScheduler.queueEmail(user.email, 'password_reset', {
      email: user.email,
      firstName: user.firstName,
      resetUrl
    });

    res.json({ message: 'Password reset email sent successfully' });
  } catch (error) {
    console.error('💥 Forgot password error:', error);
    next(error);
  }
};

const resetPassword = asyncHandler(async (req, res, next) => {
  const { token, password } = req.body;

  if (!token || !password) {
    return res.status(400).json({ error: 'Token and password are required' });
  }

  console.log('🔄 Password reset attempt for token:', token.substring(0, 10) + '...');

  // Find user with valid reset token
  const user = await User.findOne({
    where: {
      resetPasswordToken: token,
      resetPasswordExpires: {
        [require('sequelize').Op.gt]: new Date()
      }
    }
  });

  if (!user) {
    console.log('❌ Invalid or expired token');
    return res.status(400).json({ error: 'Invalid or expired reset token' });
  }

  console.log('✅ Valid token found for user:', user.email);

  // Hash new password with explicit salt rounds
  const hashedPassword = await bcrypt.hash(password, parseInt(bcryptRounds) || 12);
  console.log('🔐 Password hashed successfully with salt rounds:', parseInt(bcryptRounds) || 12);
  console.log('🔍 New hash length:', hashedPassword.length);

  // Update user password and clear reset token
  const updateResult = await user.update({
    password: hashedPassword,
    resetPasswordToken: null,
    resetPasswordExpires: null
  });

  console.log('💾 Password updated in database:', !!updateResult);

  res.json({ message: 'Password reset successfully' });
});

const logout = async (req, res) => {
  res.clearCookie('token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict'
  });
  res.json({ message: 'Logged out successfully' });
};

module.exports = {
  register,
  registerAdmin: asyncHandler(registerAdmin),
  login: asyncHandler(login),
  logout,
  getProfile: asyncHandler(getProfile),
  forgotPassword: asyncHandler(forgotPassword),
  resetPassword: asyncHandler(resetPassword)
};