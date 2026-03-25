const fs = require('fs');
const path = require('path');

const getBaseUrl = () => process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 5000}`;

/**
 * "Uploads" a file by moving it from the temp multer path to the uploads folder
 * and returning a local URL. Keeps the same signature as the old Cloudinary version.
 */
const SUBFOLDER_MAP = {
  profilePicture: 'profile-images',
  profileImage:   'profile-images',
  idDocuments:    'id-documents',
  supportingDocuments: 'supporting-documents',
};

const uploadToCloudinary = async (file, folder = 'caregiver-documents') => {
  try {
    // Multer already saved the file to the correct subfolder via diskStorage
    const sub = SUBFOLDER_MAP[file.fieldname] || 'other';
    const filename = path.basename(file.path);
    const ext = path.extname(file.originalname).replace('.', '') || 'bin';
    const url = `${getBaseUrl()}/uploads/${sub}/${filename}`;

    return {
      url,
      public_id: `${sub}/${filename}`,
      format: ext,
      resource_type: file.mimetype?.startsWith('image/') ? 'image' : 'raw',
    };
  } catch (error) {
    console.error('Local upload error:', error);
    throw new Error('Failed to process uploaded file');
  }
};

/**
 * Deletes a locally stored file by its public_id (filename).
 */
const deleteFromCloudinary = async (public_id) => {
  try {
    // public_id is now "subfolder/filename" e.g. "profile-images/profilePicture-123.jpg"
    const filePath = path.resolve(__dirname, '../../uploads', public_id);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (error) {
    console.error('Local file delete error:', error);
  }
};

module.exports = { uploadToCloudinary, deleteFromCloudinary };
