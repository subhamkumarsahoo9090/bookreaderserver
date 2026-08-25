const express = require('express');
const {
  listVocabulary,
  saveWord,
  deleteWord,
} = require('../controllers/vocabularyController');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.use(protect);

router.get('/', listVocabulary);
router.post('/', saveWord);
router.delete('/:id', deleteWord);

module.exports = router;
