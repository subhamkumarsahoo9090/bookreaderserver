const express = require('express');
const {
  upsertProgress,
  getProgress,
  listProgress,
} = require('../controllers/progressController');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.use(protect);
router.get('/', listProgress);
router.put('/', upsertProgress);
router.get('/:documentId', getProgress);

module.exports = router;
