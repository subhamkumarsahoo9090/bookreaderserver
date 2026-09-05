const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const THEMES = ['paper', 'night', 'sepia', 'contrast'];
const ROLES = ['reader', 'teacher', 'parent', 'admin'];
const FONT_FAMILIES = [
  'outfit',
  'fraunces',
  'literata',
  'noto-devanagari',
  'noto-oriya',
  'opendyslexic',
];

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      minlength: 6,
      select: false,
    },
    googleId: { type: String, sparse: true, unique: true },
    name: { type: String, trim: true },
    avatar: { type: String },
    role: {
      type: String,
      enum: ROLES,
      default: 'reader',
    },
    googleTokens: {
      accessToken: { type: String, select: false },
      refreshToken: { type: String, select: false },
      expiryDate: { type: Number, select: false },
      scope: { type: String, select: false },
    },
    driveRootFolderId: { type: String },
    driveConnected: { type: Boolean, default: false },
    settings: {
      theme: { type: String, enum: THEMES, default: 'paper' },
      dyslexiaFont: { type: Boolean, default: false },
      lineSpacing: { type: Number, default: 1.6, min: 1.2, max: 2.4 },
      preferredLanguage: { type: String, default: 'hi', trim: true },
      readingFontFamily: {
        type: String,
        enum: FONT_FAMILIES,
        default: 'fraunces',
      },
      editorFontFamily: {
        type: String,
        enum: FONT_FAMILIES,
        default: 'outfit',
      },
      fontSize: { type: Number, default: 18, min: 12, max: 32 },
    },
    streak: {
      current: { type: Number, default: 0 },
      longest: { type: Number, default: 0 },
      lastActiveDate: { type: String, default: '' },
    },
  },
  { timestamps: { createdAt: true, updatedAt: true } }
);

userSchema.pre('save', async function hashPassword(next) {
  if (!this.isModified('password') || !this.password) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.comparePassword = function comparePassword(candidate) {
  if (!this.password) return Promise.resolve(false);
  return bcrypt.compare(candidate, this.password);
};

userSchema.methods.bumpStreak = function bumpStreak() {
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  if (this.streak.lastActiveDate === today) return;
  if (this.streak.lastActiveDate === yesterday) {
    this.streak.current += 1;
  } else {
    this.streak.current = 1;
  }
  if (this.streak.current > this.streak.longest) {
    this.streak.longest = this.streak.current;
  }
  this.streak.lastActiveDate = today;
};

userSchema.statics.THEMES = THEMES;
userSchema.statics.ROLES = ROLES;
userSchema.statics.FONT_FAMILIES = FONT_FAMILIES;

module.exports = mongoose.model('User', userSchema);
