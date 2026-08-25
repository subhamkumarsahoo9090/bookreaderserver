const { verifyToken } = require('../utils/jwt');
const User = require('../models/User');
const AppError = require('../utils/AppError');

async function protect(req, _res, next) {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      return next(new AppError('Authentication required', 401));
    }

    const token = header.slice(7);
    const decoded = verifyToken(token);
    const user = await User.findById(decoded.id);
    if (!user) {
      return next(new AppError('User no longer exists', 401));
    }

    req.user = user;
    next();
  } catch (_err) {
    next(new AppError('Invalid or expired token', 401));
  }
}

module.exports = { protect };
