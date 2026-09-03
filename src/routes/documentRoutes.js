const express = require('express');
const {
  processDocument,
  recognizeSnippet,
  createFromText,
  listDocuments,
  getDocument,
  updateDocument,
  deleteDocument,
} = require('../controllers/documentController');
const { protect } = require('../middleware/auth');
const upload = require('../middleware/upload');

const router = express.Router();

router.use(protect);

router.post('/process', upload.single('file'), processDocument);
router.post('/recognize', upload.single('file'), recognizeSnippet);
router.post('/from-text', createFromText);
router.get('/', listDocuments);
router.get('/:id', getDocument);
router.patch('/:id', updateDocument);
router.delete('/:id', deleteDocument);

module.exports = router;
