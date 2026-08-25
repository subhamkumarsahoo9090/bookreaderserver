const express = require('express');
const {
  listFolders,
  createFolder,
  updateFolder,
  deleteFolder,
} = require('../controllers/folderController');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.use(protect);

router.get('/', listFolders);
router.post('/', createFolder);
router.patch('/:id', updateFolder);
router.delete('/:id', deleteFolder);

module.exports = router;
