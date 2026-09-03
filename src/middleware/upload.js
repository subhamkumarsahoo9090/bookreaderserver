const multer = require('multer');
const path = require('path');
const AppError = require('../utils/AppError');

const maxMb = Number(process.env.MAX_FILE_SIZE_MB) || 15;

const allowedMimes = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/tiff',
  'application/pdf',
  'text/plain',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/rtf',
  'text/rtf',
  'application/epub+zip',
  'application/epub',
  'application/zip', // some browsers send epub as zip
  'application/octet-stream', // fallback; validated by extension
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/webm',
  'audio/ogg',
  'audio/mp4',
  'audio/x-m4a',
  'audio/m4a',
]);

const allowedExt = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.gif',
  '.tif',
  '.tiff',
  '.pdf',
  '.txt',
  '.text',
  '.docx',
  '.rtf',
  '.epub',
  '.mp3',
  '.wav',
  '.webm',
  '.ogg',
  '.m4a',
  '.mp4',
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: maxMb * 1024 * 1024 },
  fileFilter(_req, file, cb) {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const mimeOk = allowedMimes.has(file.mimetype);
    const extOk = allowedExt.has(ext);

    if (!mimeOk && !extOk) {
      return cb(
        new AppError(
          'Allowed: images, PDF, TXT, DOCX, RTF, EPUB, audio (mp3/wav/webm/m4a)',
          400
        )
      );
    }
    if (file.mimetype === 'application/octet-stream' && !extOk) {
      return cb(new AppError('Unrecognized file type', 400));
    }
    cb(null, true);
  },
});

module.exports = upload;
