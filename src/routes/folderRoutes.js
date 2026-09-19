const express = require('express');
const {
  listFolders,
  getFolder,
  createFolder,
  updateFolder,
  deleteFolder,
} = require('../controllers/folderController');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.use(protect);

router.get('/', listFolders);
router.post('/', createFolder);
router.get('/:id', getFolder);
router.patch('/:id', updateFolder);
router.delete('/:id', deleteFolder);

module.exports = router;
