const multer = require('multer');
const AppError = require('../utils/AppError');

const maxMb = Number(process.env.MAX_FILE_SIZE_MB) || 15;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: maxMb * 1024 * 1024 },
  fileFilter(_req, file, cb) {
    const allowed = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/webp',
      'image/gif',
      'image/tiff',
      'application/pdf',
    ];
    if (!allowed.includes(file.mimetype)) {
      return cb(
        new AppError(
          'Only images (jpeg, png, webp, gif, tiff) and PDF files are allowed',
          400
        )
      );
    }
    cb(null, true);
  },
});

module.exports = upload;
