const { v2: cloudinary } = require('cloudinary');
const axios = require('axios');
const crypto = require('crypto');
const fs = require('fs');
const FormData = require('form-data');

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.CLOUD_API_KEY,
  api_secret: process.env.CLOUD_API_SECRET,
});

const normalizeMediaUrl = (value) => {
  if (!value) return null;
  const match = String(value).match(/https?:\/\/[^"'\]\s)]+/);
  return match ? match[0].replace(/\/$/, '') : null;
};

const getFirstAllowedMediaBaseUrl = () => {
  const configured = process.env.MEDIA_BASE_URL || process.env.ALLOWED_MEDIA_BASE_URLS;

  if (!configured) return null;

  try {
    const parsed = JSON.parse(configured);
    if (Array.isArray(parsed)) {
      return normalizeMediaUrl(parsed[0]);
    }
    return normalizeMediaUrl(parsed);
  } catch {
    return normalizeMediaUrl(configured);
  }
};

const getMediaBaseUrl = () => {
  return getFirstAllowedMediaBaseUrl() || 'https://media.aircnc.co.ke';
};

const getMediaApiKey = () => process.env.MEDIA_API_KEY || process.env.API_KEY;

const getMediaClientId = () => process.env.MEDIA_CLIENT_ID || 'care-connect';

const getResourceTypeFromMime = (mime = '') => {
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('audio/')) return 'audio';
  return 'raw';
};

const getMediaFileFromUrl = (url) => {
  if (!url) return null;

  try {
    const mediaBaseUrl = getMediaBaseUrl();
    const parsedUrl = new URL(url);
    const parsedBaseUrl = new URL(mediaBaseUrl);

    if (parsedUrl.host !== parsedBaseUrl.host) return null;

    const [bucket, ...keyParts] = parsedUrl.pathname.split('/').filter(Boolean);
    if (!bucket || keyParts.length === 0) return null;

    return {
      provider: 'media-server',
      bucket,
      key: decodeURIComponent(keyParts.join('/')),
      id: decodeURIComponent(keyParts.join('/')),
      url
    };
  } catch {
    return null;
  }
};

const uploadToMediaServer = async (file) => {
  const mediaBaseUrl = getMediaBaseUrl();
  const apiKey = getMediaApiKey();

  if (!apiKey) {
    throw new Error('Media server API key is not configured');
  }

  const form = new FormData();
  form.append('file', fs.createReadStream(file.path), {
    filename: file.originalname,
    contentType: file.mimetype
  });

  let response;
  try {
    response = await axios.post(`${mediaBaseUrl}/upload/`, form, {
      headers: {
        'X-API-Key': apiKey,
        'X-Client-Id': getMediaClientId(),
        'X-Media-Base-Url': mediaBaseUrl,
        ...form.getHeaders()
      },
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
      timeout: 120000
    });
  } catch (error) {
    console.error('Media server upload failed:', {
      baseUrl: mediaBaseUrl,
      status: error.response?.status,
      code: error.code,
      message: error.message,
      response: error.response?.data
    });
    throw new Error('Failed to upload file to media server');
  }

  const uploaded = response.data;
  return {
    url: uploaded.url,
    public_id: uploaded.id,
    id: uploaded.id,
    bucket: uploaded.bucket,
    key: uploaded.id,
    filename: file.originalname,
    format: uploaded.id?.split('.').pop(),
    resource_type: getResourceTypeFromMime(uploaded.mime || file.mimetype),
    mime: uploaded.mime || file.mimetype,
    size: uploaded.size || file.size,
    provider: 'media-server'
  };
};

const uploadToCloudinary = async (file, folder = 'caregiver-documents') => {
  if (getMediaApiKey()) {
    return uploadToMediaServer(file);
  }

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
    if (typeof public_id === 'object' && public_id?.provider === 'media-server') {
      const mediaBaseUrl = getMediaBaseUrl();
      await axios.delete(`${mediaBaseUrl}/upload/${public_id.bucket}/${public_id.key || public_id.id}`, {
        headers: { 'X-API-Key': getMediaApiKey() },
        timeout: 30000
      });
      return;
    }

    await cloudinary.uploader.destroy(public_id);
  } catch (error) {
    console.error('Media delete error:', error);
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

const streamMediaServerFile = async (res, document) => {
  const mediaFile = document?.bucket
    ? document
    : getMediaFileFromUrl(document?.url);

  if (!mediaFile?.url) {
    return res.status(404).json({ error: 'Media file not found' });
  }

  const response = await axios.get(mediaFile.url, {
    responseType: 'stream',
    timeout: 30000
  });

  if (response.headers['content-type']) {
    res.setHeader('Content-Type', response.headers['content-type']);
  }

  if (response.headers['content-length']) {
    res.setHeader('Content-Length', response.headers['content-length']);
  }

  const filename = document.filename || mediaFile.key || mediaFile.id;
  if (filename) {
    res.setHeader('Content-Disposition', `inline; filename="${String(filename).replace(/"/g, '')}"`);
  }

  response.data.pipe(res);
};

const streamStoredFile = async (res, document) => {
  const mediaFile = document?.provider === 'media-server' || document?.bucket || getMediaFileFromUrl(document?.url);

  if (mediaFile) {
    return streamMediaServerFile(res, {
      ...document,
      ...mediaFile
    });
  }

  return streamCloudinaryFile(res, document);
};

module.exports = {
  uploadToCloudinary,
  deleteFromCloudinary,
  getSignedFileUrl,
  getCloudinaryFileFromUrl,
  getMediaFileFromUrl,
  getSignedDownloadUrl,
  streamCloudinaryFile,
  streamMediaServerFile,
  streamStoredFile,
};
