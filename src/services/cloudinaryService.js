const { v2: cloudinary } = require('cloudinary');
const axios = require('axios');
const crypto = require('crypto');

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.CLOUD_API_KEY,
  api_secret: process.env.CLOUD_API_SECRET,
});

const uploadToCloudinary = async (file, folder = 'caregiver-documents') => {
  try {
    const result = await cloudinary.uploader.upload(file.path, {
      folder: folder,
      resource_type: 'auto', // Handles images, videos, and raw files (PDFs, docs)
      public_id: `${Date.now()}-${file.originalname}`,
    });
    
    return {
      url: result.secure_url,
      public_id: result.public_id,
      format: result.format,
      resource_type: result.resource_type,
    };
  } catch (error) {
    console.error('Cloudinary upload error:', error);
    throw new Error('Failed to upload file to cloud storage');
  }
};

const deleteFromCloudinary = async (public_id) => {
  try {
    await cloudinary.uploader.destroy(public_id);
  } catch (error) {
    console.error('Cloudinary delete error:', error);
  }
};

const getSignedFileUrl = ({ public_id, resource_type = 'image', format, expiresInSeconds = 300 }) => {
  const expiresAt = Math.floor(Date.now() / 1000) + expiresInSeconds;
  return cloudinary.url(public_id, {
    secure: true,
    sign_url: true,
    resource_type,
    type: 'upload',
    format,
    expires_at: expiresAt
  });
};

const getSignedDownloadUrl = ({ public_id, resource_type = 'raw', format, expiresInSeconds = 300, attachment = false }) => {
  const signatureParams = {
    attachment: String(attachment),
    expires_at: Math.floor(Date.now() / 1000) + expiresInSeconds,
    public_id,
    type: 'upload'
  };

  if (format) {
    signatureParams.format = format;
  }

  const signaturePayload = Object.keys(signatureParams)
    .sort()
    .map((key) => `${key}=${signatureParams[key]}`)
    .join('&');
  const signature = crypto
    .createHash('sha1')
    .update(`${signaturePayload}${process.env.CLOUD_API_SECRET}`)
    .digest('hex');

  const params = {
    ...signatureParams,
    api_key: process.env.CLOUD_API_KEY,
    signature
  };
  const query = new URLSearchParams(params).toString();
  return `https://api.cloudinary.com/v1_1/${process.env.CLOUD_NAME}/${resource_type}/download?${query}`;
};

const streamCloudinaryFile = async (res, { public_id, resource_type = 'raw', format, filename }) => {
  const signedUrl = getSignedDownloadUrl({
    public_id,
    resource_type,
    format,
    attachment: false
  });
  const response = await axios.get(signedUrl, {
    responseType: 'stream',
    timeout: 30000
  });

  if (response.headers['content-type']) {
    res.setHeader('Content-Type', response.headers['content-type']);
  }

  if (response.headers['content-length']) {
    res.setHeader('Content-Length', response.headers['content-length']);
  }

  if (filename) {
    res.setHeader('Content-Disposition', `inline; filename="${String(filename).replace(/"/g, '')}"`);
  }

  response.data.pipe(res);
};

module.exports = {
  uploadToCloudinary,
  deleteFromCloudinary,
  getSignedFileUrl,
  getSignedDownloadUrl,
  streamCloudinaryFile,
};
