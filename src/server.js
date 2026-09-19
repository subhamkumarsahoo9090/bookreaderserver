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
    try {
      const Folder = require('./models/Folder');
      const Document = require('./models/Document');
      const SharedBook = require('./models/SharedBook');
      // Drop legacy indexes that conflict with nested folders / OCR language field
      await Folder.syncIndexes();
      await Document.syncIndexes();
      await SharedBook.syncIndexes();
    } catch (e) {
      console.warn('Index sync skipped:', e.message);
    }
    app.listen(PORT, () => {
      console.log(`Book Reader API listening on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Failed to start server:', err.message);
    process.exit(1);
  });
