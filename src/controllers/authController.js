const User = require('../models/User');
const { signToken } = require('../utils/jwt');
const AppError = require('../utils/AppError');

async function register(req, res, next) {
  try {
    const { email, password } = req.body;
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
    });

    const token = signToken(user._id);
    res.status(201).json({
      success: true,
      token,
      user: { id: user._id, email: user.email, createdAt: user.createdAt },
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
      user: { id: user._id, email: user.email, createdAt: user.createdAt },
    });
  } catch (err) {
    next(err);
  }
}

async function me(req, res) {
  res.json({
    success: true,
    user: {
      id: req.user._id,
      email: req.user.email,
      createdAt: req.user.createdAt,
    },
  });
}

module.exports = { register, login, me };
