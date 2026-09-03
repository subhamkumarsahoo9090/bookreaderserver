const express = require('express');
const {
  listAnnotations,
  createAnnotation,
  updateAnnotation,
  deleteAnnotation,
} = require('../controllers/annotationController');
const { protect } = require('../middleware/auth');

const router = express.Router();
router.use(protect);
router.get('/', listAnnotations);
router.post('/', createAnnotation);
router.patch('/:id', updateAnnotation);
router.delete('/:id', deleteAnnotation);

module.exports = router;
