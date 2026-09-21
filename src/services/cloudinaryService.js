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

const getCloudinaryFileFromUrl = (url) => {
  if (!url || !url.includes('res.cloudinary.com')) return null;

  try {
    const parsedUrl = new URL(url);
    const parts = parsedUrl.pathname.split('/').filter(Boolean);
    const uploadIndex = parts.indexOf('upload');

    if (parts.length < 4 || uploadIndex === -1 || uploadIndex + 1 >= parts.length) {
      return null;
    }

    const resource_type = parts[1];
    const fileParts = parts.slice(uploadIndex + 1);
    const versionIndex = fileParts.findIndex((part) => /^v\d+$/.test(part));
    const publicIdParts = versionIndex >= 0 ? fileParts.slice(versionIndex + 1) : fileParts;

    if (publicIdParts.length === 0) return null;

    const public_id = decodeURIComponent(publicIdParts.join('/'));
    const extensionMatch = public_id.match(/\.([a-zA-Z0-9]+)$/);

    return {
      public_id,
      resource_type,
      format: extensionMatch?.[1]
    };
  } catch {
    return null;
  }
};

const getSignedDownloadUrl = ({ public_id, resource_type = 'raw', format, expiresInSeconds = 300, attachment = false }) => {
  const expiresAt = Math.floor(Date.now() / 1000) + expiresInSeconds;

  if (cloudinary.utils?.private_download_url) {
    return cloudinary.utils.private_download_url(public_id, format, {
      resource_type,
      type: 'upload',
      expires_at: expiresAt,
      attachment
    });
  }

  const signatureParams = {
    attachment: String(attachment),
    expires_at: expiresAt,
    public_id,
    timestamp: Math.floor(Date.now() / 1000),
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
  getCloudinaryFileFromUrl,
  getSignedDownloadUrl,
  streamCloudinaryFile,
};
