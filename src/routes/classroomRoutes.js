const express = require('express');
const {
  createClassroom,
  listClassrooms,
  joinClassroom,
  assignFolder,
  getClassroom,
} = require('../controllers/classroomController');
const { protect } = require('../middleware/auth');

const router = express.Router();
router.use(protect);
router.get('/', listClassrooms);
router.post('/', createClassroom);
router.post('/join', joinClassroom);
router.get('/:id', getClassroom);
router.post('/:id/assign-folder', assignFolder);

module.exports = router;
