const express = require('express');
const { dueCards, reviewCard } = require('../controllers/flashcardController');
const { protect } = require('../middleware/auth');

const router = express.Router();
router.use(protect);
router.get('/due', dueCards);
router.post('/:id/review', reviewCard);

module.exports = router;
