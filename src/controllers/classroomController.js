const crypto = require('crypto');
const Classroom = require('../models/Classroom');
const Folder = require('../models/Folder');
const AppError = require('../utils/AppError');

function inviteCode() {
  return crypto.randomBytes(3).toString('hex').toUpperCase();
}

async function createClassroom(req, res, next) {
  try {
    const name = (req.body.name || '').trim();
    if (!name) throw new AppError('name is required', 400);

    const classroom = await Classroom.create({
      name,
      teacherId: req.user._id,
      inviteCode: inviteCode(),
      memberIds: [],
      folderIds: [],
    });

    if (req.user.role === 'reader') {
      req.user.role = 'teacher';
      await req.user.save();
    }

    res.status(201).json({ success: true, classroom });
  } catch (err) {
    next(err);
  }
}

async function listClassrooms(req, res, next) {
  try {
    const classrooms = await Classroom.find({
      $or: [{ teacherId: req.user._id }, { memberIds: req.user._id }],
    }).sort({ updatedAt: -1 });
    res.json({ success: true, classrooms });
  } catch (err) {
    next(err);
  }
}

async function joinClassroom(req, res, next) {
  try {
    const code = String(req.body.inviteCode || '').trim().toUpperCase();
    if (!code) throw new AppError('inviteCode is required', 400);

    const classroom = await Classroom.findOne({ inviteCode: code });
    if (!classroom) throw new AppError('Invalid invite code', 404);

    if (
      String(classroom.teacherId) !== String(req.user._id) &&
      !classroom.memberIds.some((id) => String(id) === String(req.user._id))
    ) {
      classroom.memberIds.push(req.user._id);
      await classroom.save();
    }

    res.json({ success: true, classroom });
  } catch (err) {
    next(err);
  }
}

async function assignFolder(req, res, next) {
  try {
    const classroom = await Classroom.findOne({
      _id: req.params.id,
      teacherId: req.user._id,
    });
    if (!classroom) throw new AppError('Classroom not found', 404);

    const folder = await Folder.findOne({
      _id: req.body.folderId,
      userId: req.user._id,
    });
    if (!folder) throw new AppError('Folder not found', 404);

    if (!classroom.folderIds.some((id) => String(id) === String(folder._id))) {
      classroom.folderIds.push(folder._id);
      await classroom.save();
    }

    res.json({ success: true, classroom });
  } catch (err) {
    next(err);
  }
}

async function getClassroom(req, res, next) {
  try {
    const classroom = await Classroom.findById(req.params.id)
      .populate('folderIds', 'name')
      .populate('memberIds', 'email')
      .populate('teacherId', 'email');
    if (!classroom) throw new AppError('Classroom not found', 404);

    const isMember =
      String(classroom.teacherId._id || classroom.teacherId) ===
        String(req.user._id) ||
      classroom.memberIds.some(
        (m) => String(m._id || m) === String(req.user._id)
      );
    if (!isMember) throw new AppError('Not a member of this classroom', 403);

    res.json({ success: true, classroom });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createClassroom,
  listClassrooms,
  joinClassroom,
  assignFolder,
  getClassroom,
};
