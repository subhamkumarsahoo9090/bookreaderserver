const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const THEMES = ['paper', 'night', 'sepia', 'contrast'];

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
      required: true,
      minlength: 6,
      select: false,
    },
    role: {
      type: String,
      enum: ['reader', 'teacher', 'parent'],
      default: 'reader',
    },
    settings: {
      theme: {
        type: String,
        enum: THEMES,
        default: 'paper',
      },
      dyslexiaFont: { type: Boolean, default: false },
      lineSpacing: {
        type: Number,
        default: 1.6,
        min: 1.2,
        max: 2.4,
      },
      preferredLanguage: {
        type: String,
        default: 'hi',
        trim: true,
      },
    },
    streak: {
      current: { type: Number, default: 0 },
      longest: { type: Number, default: 0 },
      lastActiveDate: { type: String, default: '' }, // YYYY-MM-DD
    },
  },
  { timestamps: { createdAt: true, updatedAt: true } }
);

userSchema.pre('save', async function hashPassword(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.comparePassword = function comparePassword(candidate) {
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

module.exports = mongoose.model('User', userSchema);
