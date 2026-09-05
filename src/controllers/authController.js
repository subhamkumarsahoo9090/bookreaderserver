const User = require('../models/User');
const { signToken } = require('../utils/jwt');
const AppError = require('../utils/AppError');
const driveService = require('../services/driveService');

function publicUser(user) {
  return {
    id: user._id,
    email: user.email,
    name: user.name || '',
    avatar: user.avatar || '',
    role: user.role || 'reader',
    driveConnected: Boolean(user.driveConnected),
    createdAt: user.createdAt,
    settings: {
      theme: (user.settings && user.settings.theme) || 'paper',
      dyslexiaFont: Boolean(user.settings && user.settings.dyslexiaFont),
      lineSpacing: (user.settings && user.settings.lineSpacing) || 1.6,
      preferredLanguage:
        (user.settings && user.settings.preferredLanguage) || 'hi',
      readingFontFamily:
        (user.settings && user.settings.readingFontFamily) || 'fraunces',
      editorFontFamily:
        (user.settings && user.settings.editorFontFamily) || 'outfit',
      fontSize: (user.settings && user.settings.fontSize) || 18,
    },
    streak: user.streak || { current: 0, longest: 0, lastActiveDate: '' },
  };
}

function applyAdminAllowlist(user) {
  const list = (process.env.ADMIN_EMAILS || process.env.ADMIN_EMAIL || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (list.includes(user.email) && user.role !== 'admin') {
    user.role = 'admin';
  }
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
    applyAdminAllowlist(user);
    await user.save();

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

    applyAdminAllowlist(user);
    await user.save();

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
    googleConfigured: driveService.isGoogleConfigured(),
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
      req.user.settings.preferredLanguage =
        String(req.body.preferredLanguage).trim() || 'hi';
    }
    if (req.body.readingFontFamily !== undefined) {
      if (!User.FONT_FAMILIES.includes(req.body.readingFontFamily)) {
        throw new AppError('Invalid readingFontFamily', 400);
      }
      req.user.settings.readingFontFamily = req.body.readingFontFamily;
    }
    if (req.body.editorFontFamily !== undefined) {
      if (!User.FONT_FAMILIES.includes(req.body.editorFontFamily)) {
        throw new AppError('Invalid editorFontFamily', 400);
      }
      req.user.settings.editorFontFamily = req.body.editorFontFamily;
    }
    if (req.body.fontSize !== undefined) {
      const fs = Number(req.body.fontSize);
      if (Number.isNaN(fs) || fs < 12 || fs > 32) {
        throw new AppError('fontSize must be 12–32', 400);
      }
      req.user.settings.fontSize = fs;
    }

    await req.user.save();
    res.json({ success: true, user: publicUser(req.user) });
  } catch (err) {
    next(err);
  }
}

function googleStart(req, res, next) {
  try {
    if (!driveService.isGoogleConfigured()) {
      throw new AppError(
        'Google sign-in is not configured on the server',
        503
      );
    }
    const state = req.query.state === 'drive' ? 'drive' : 'login';
    const url = driveService.getAuthUrl(state);
    res.json({ success: true, url });
  } catch (err) {
    next(err);
  }
}

async function googleCallback(req, res, next) {
  try {
    const { code, state } = req.query;
    if (!code) throw new AppError('Missing Google auth code', 400);

    const { tokens, profile } = await driveService.exchangeCode(code);
    const email = (profile.email || '').toLowerCase();
    if (!email) throw new AppError('Google account has no email', 400);

    let user = await User.findOne({ email }).select('+googleTokens');
    if (!user) {
      user = new User({
        email,
        googleId: profile.id,
        name: profile.name || '',
        avatar: profile.picture || '',
        role: 'reader',
      });
    } else {
      user.googleId = profile.id;
      user.name = user.name || profile.name || '';
      user.avatar = profile.picture || user.avatar;
    }

    applyAdminAllowlist(user);
    await driveService.persistUserTokens(user, tokens);

    try {
      const rootId = await driveService.ensureAksharaRoot(user);
      user.driveRootFolderId = rootId;
      user.driveConnected = true;
      await user.save();
    } catch (e) {
      // tokens saved; root folder may fail without drive scope
      console.warn('Drive root setup:', e.message);
    }

    const jwt = signToken(user._id);
    const frontend =
      process.env.FRONTEND_URL || 'http://localhost:3000';
    const dest =
      state === 'drive'
        ? `${frontend}/settings?drive=connected&token=${jwt}`
        : `${frontend}/auth/callback?token=${jwt}`;
    res.redirect(dest);
  } catch (err) {
    next(err);
  }
}

async function driveStatus(req, res) {
  res.json({
    success: true,
    connected: Boolean(req.user.driveConnected),
    googleConfigured: driveService.isGoogleConfigured(),
    rootFolderId: req.user.driveRootFolderId || null,
  });
}

async function disconnectDrive(req, res, next) {
  try {
    req.user.googleTokens = undefined;
    req.user.driveConnected = false;
    await req.user.save();
    res.json({ success: true, message: 'Google Drive disconnected' });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  register,
  login,
  me,
  updateSettings,
  googleStart,
  googleCallback,
  driveStatus,
  disconnectDrive,
  publicUser,
};
