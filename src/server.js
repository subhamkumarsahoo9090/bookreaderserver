require('dotenv').config();
const app = require('./app');
const connectDB = require('./config/db');
const { seedAdmin } = require('./utils/seedAdmin');

const PORT = process.env.PORT || 5000;

connectDB()
  .then(async () => {
    try {
      await seedAdmin();
    } catch (e) {
      console.warn('Admin seed skipped:', e.message);
    }
    app.listen(PORT, () => {
      console.log(`Book Reader API listening on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Failed to start server:', err.message);
    process.exit(1);
  });
