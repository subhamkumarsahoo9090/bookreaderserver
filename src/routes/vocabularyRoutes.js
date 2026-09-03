const express = require('express');
const {
  listVocabulary,
  saveWord,
  updateWord,
  deleteWord,
} = require('../controllers/vocabularyController');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.use(protect);

router.get('/', listVocabulary);
router.post('/', saveWord);
router.patch('/:id', updateWord);
router.delete('/:id', deleteWord);

module.exports = router;
