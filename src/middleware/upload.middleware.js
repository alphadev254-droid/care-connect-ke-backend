const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, process.env.UPLOAD_PATH || './uploads');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|pdf|doc|docx/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new Error('Invalid file type'));
  }
};

const upload = multer({
  storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10485760 // 10MB
  },
  fileFilter
});

const uploadMultiple = upload.fields([
  { name: 'supportingDocuments', maxCount: 5 },
  { name: 'profilePicture', maxCount: 1 },
  { name: 'profileImage', maxCount: 1 },
  { name: 'idDocuments', maxCount: 3 }
]);

// Multer error handling middleware
const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    // Multer-specific errors
    const maxSizeMB = (parseInt(process.env.MAX_FILE_SIZE) || 10485760) / (1024 * 1024);

    switch (err.code) {
      case 'LIMIT_FILE_SIZE':
        return res.status(400).json({
          error: `File too large. Maximum file size is ${maxSizeMB}MB per file.`,
          code: 'FILE_TOO_LARGE',
          maxSize: maxSizeMB + 'MB'
        });
      case 'LIMIT_FILE_COUNT':
        return res.status(400).json({
          error: 'Too many files uploaded.',
          code: 'TOO_MANY_FILES'
        });
      case 'LIMIT_UNEXPECTED_FILE':
        return res.status(400).json({
          error: 'Unexpected field in file upload.',
          code: 'UNEXPECTED_FIELD'
        });
      default:
        return res.status(400).json({
          error: 'File upload error: ' + err.message,
          code: 'UPLOAD_ERROR'
        });
    }
  } else if (err) {
    // Other errors (like invalid file type from fileFilter)
    if (err.message === 'Invalid file type') {
      return res.status(400).json({
        error: 'Invalid file type. Only JPEG, PNG, PDF, DOC, and DOCX files are allowed.',
        code: 'INVALID_FILE_TYPE'
      });
    }
    // Pass other errors to the next error handler
    return next(err);
  }
  next();
};

module.exports = { upload, uploadMultiple, handleMulterError };