const express = require('express');
const {
  listPublished,
  getPublished,
  adminList,
  adminUpload,
  adminUpdate,
  adminDelete,
} = require('../controllers/sharedLibraryController');
const { protect } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/requireAdmin');
const upload = require('../middleware/upload');

const router = express.Router();

router.use(protect);

// Admin routes first so they are not swallowed by /:id
router.get('/admin/all', requireAdmin, adminList);
router.post('/admin', requireAdmin, upload.single('file'), adminUpload);
router.patch('/admin/:id', requireAdmin, adminUpdate);
router.delete('/admin/:id', requireAdmin, adminDelete);

router.get('/', listPublished);
router.get('/:id', getPublished);

module.exports = router;
