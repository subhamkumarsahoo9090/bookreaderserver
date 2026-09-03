const express = require('express');
const {
  searchLibrary,
  exportMarkdown,
  listPublicLibrary,
} = require('../controllers/searchController');
const { getPublicDocument, toggleShare } = require('../controllers/progressController');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.get('/public', listPublicLibrary);
router.get('/public/:slug', getPublicDocument);

router.get('/search', protect, searchLibrary);
router.get('/export', protect, exportMarkdown);
router.post('/documents/:id/share', protect, toggleShare);

module.exports = router;
