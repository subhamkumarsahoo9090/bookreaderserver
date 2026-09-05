const User = require('../models/User');

async function seedAdmin() {
  const email = (
    process.env.ADMIN_EMAIL || 'subhamkumarsahoo9090@gmail.com'
  )
    .toLowerCase()
    .trim();
  const password = process.env.ADMIN_PASSWORD || '123456';

  let user = await User.findOne({ email }).select('+password');
  if (!user) {
    user = await User.create({
      email,
      password,
      role: 'admin',
      name: 'Admin',
    });
    console.log(`Admin user created: ${email}`);
    return;
  }

  let changed = false;
  if (user.role !== 'admin') {
    user.role = 'admin';
    changed = true;
  }
  // Ensure known password for bootstrap admin
  if (password) {
    user.password = password;
    changed = true;
  }
  if (changed) {
    await user.save();
    console.log(`Admin user updated: ${email}`);
  }
}

module.exports = { seedAdmin };
