const crypto = require('crypto');

const generateToken = (length = 32) => {
  return crypto.randomBytes(length).toString('hex');
};

const formatDate = (date) => {
  return new Date(date).toISOString();
};

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
      return [];
    }
  }
  return [value];
};

const sanitizeDocuments = (documents) => asArray(documents).map((document, index) => {
  if (typeof document === 'string') {
    return {
      filename: document.split('/').pop() || `Document ${index + 1}`,
      format: document.split('.').pop() || null
    };
  }

  return {
    filename: document?.filename || `Document ${index + 1}`,
    format: document?.format || document?.mime?.split('/').pop() || null,
    mime: document?.mime || null,
    size: document?.size || null
  };
});

const sanitizeCaregiverFiles = (caregiver) => {
  if (!caregiver) return caregiver;

  return {
    ...caregiver,
    profileImage: Boolean(caregiver.profileImage),
    idDocuments: sanitizeDocuments(caregiver.idDocuments),
    supportingDocuments: sanitizeDocuments(caregiver.supportingDocuments)
  };
};

const sanitizeUser = (user) => {
  const userData = user.toJSON ? user.toJSON() : user;
  const { 
    password, 
    resetPasswordToken, 
    resetPasswordExpires, 
    ...userWithoutPassword 
  } = userData;
  
  // Add role name from Role association
  if (userData.Role) {
    userWithoutPassword.role = userData.Role.name;
  }

  if (userWithoutPassword.Caregiver) {
    userWithoutPassword.Caregiver = sanitizeCaregiverFiles(userWithoutPassword.Caregiver);
  }
  
  return userWithoutPassword;
};

const paginate = (page = 1, limit = 10) => {
  const offset = (page - 1) * limit;
  return { limit: parseInt(limit), offset: parseInt(offset) };
};

module.exports = {
  generateToken,
  formatDate,
  asArray,
  sanitizeCaregiverFiles,
  sanitizeDocuments,
  sanitizeUser,
  paginate
};
