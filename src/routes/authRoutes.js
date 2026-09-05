const express = require('express');
const {
  register,
  login,
  me,
  updateSettings,
  googleStart,
  googleCallback,
  driveStatus,
  disconnectDrive,
} = require('../controllers/authController');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.get('/google', googleStart);
router.get('/google/callback', googleCallback);
router.get('/me', protect, me);
router.patch('/settings', protect, updateSettings);
router.get('/drive', protect, driveStatus);
router.delete('/drive', protect, disconnectDrive);

module.exports = router;
