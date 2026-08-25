const AppError = require('../utils/AppError');

function notFound(req, _res, next) {
  next(new AppError(`Not found: ${req.method} ${req.originalUrl}`, 404));
}

function errorHandler(err, _req, res, _next) {
  if (process.env.NODE_ENV !== 'production') {
    console.error(err);
  }

  if (err instanceof require('multer').MulterError) {
    const msg =
      err.code === 'LIMIT_FILE_SIZE'
        ? 'File too large'
        : err.message;
    return res.status(400).json({ success: false, error: msg });
  }

  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern || {})[0] || 'field';
    return res.status(409).json({
      success: false,
      error: `Duplicate value for ${field}`,
    });
  }

  if (err.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      error: Object.values(err.errors)
        .map((e) => e.message)
        .join(', '),
    });
  }

  if (err.name === 'CastError') {
    return res.status(400).json({
      success: false,
      error: 'Invalid ID format',
    });
  }

  const status = err.statusCode || 500;
  const message =
    err.isOperational || status < 500
      ? err.message
      : 'Internal server error';

  res.status(status).json({ success: false, error: message });
}

module.exports = { notFound, errorHandler };
