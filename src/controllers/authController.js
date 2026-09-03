const User = require('../models/User');
const { signToken } = require('../utils/jwt');
const AppError = require('../utils/AppError');

function publicUser(user) {
  return {
    id: user._id,
    email: user.email,
    role: user.role || 'reader',
    createdAt: user.createdAt,
    settings: {
      theme: (user.settings && user.settings.theme) || 'paper',
      dyslexiaFont: Boolean(user.settings && user.settings.dyslexiaFont),
      lineSpacing: (user.settings && user.settings.lineSpacing) || 1.6,
      preferredLanguage:
        (user.settings && user.settings.preferredLanguage) || 'hi',
    },
    streak: user.streak || { current: 0, longest: 0, lastActiveDate: '' },
  };
}

async function register(req, res, next) {
  try {
    const { email, password, role } = req.body;
    if (!email || !password) {
      throw new AppError('Email and password are required', 400);
    }
    if (password.length < 6) {
      throw new AppError('Password must be at least 6 characters', 400);
    }

    const exists = await User.findOne({ email: email.toLowerCase().trim() });
    if (exists) {
      throw new AppError('Email already registered', 409);
    }

    const user = await User.create({
      email: email.toLowerCase().trim(),
      password,
      role: ['reader', 'teacher', 'parent'].includes(role) ? role : 'reader',
    });

    const token = signToken(user._id);
    res.status(201).json({
      success: true,
      token,
      user: publicUser(user),
    });
  } catch (err) {
    next(err);
  }
}

async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      throw new AppError('Email and password are required', 400);
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() }).select(
      '+password'
    );
    if (!user || !(await user.comparePassword(password))) {
      throw new AppError('Invalid email or password', 401);
    }

    const token = signToken(user._id);
    res.json({
      success: true,
      token,
      user: publicUser(user),
    });
  } catch (err) {
    next(err);
  }
}

async function me(req, res) {
  res.json({
    success: true,
    user: publicUser(req.user),
  });
}

async function updateSettings(req, res, next) {
  try {
    req.user.settings = req.user.settings || {};

    if (req.body.theme !== undefined) {
      if (!User.THEMES.includes(req.body.theme)) {
        throw new AppError(
          `theme must be one of: ${User.THEMES.join(', ')}`,
          400
        );
      }
      req.user.settings.theme = req.body.theme;
    }
    if (req.body.dyslexiaFont !== undefined) {
      req.user.settings.dyslexiaFont = Boolean(req.body.dyslexiaFont);
    }
    if (req.body.lineSpacing !== undefined) {
      const ls = Number(req.body.lineSpacing);
      if (Number.isNaN(ls) || ls < 1.2 || ls > 2.4) {
        throw new AppError('lineSpacing must be between 1.2 and 2.4', 400);
      }
      req.user.settings.lineSpacing = ls;
    }
    if (req.body.preferredLanguage !== undefined) {
      req.user.settings.preferredLanguage = String(
        req.body.preferredLanguage
      ).trim() || 'hi';
    }
    if (req.body.role && ['reader', 'teacher', 'parent'].includes(req.body.role)) {
      req.user.role = req.body.role;
    }

    await req.user.save();
    res.json({ success: true, user: publicUser(req.user) });
  } catch (err) {
    next(err);
  }
}

module.exports = { register, login, me, updateSettings };
