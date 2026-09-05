const Folder = require('../models/Folder');
const Document = require('../models/Document');
const User = require('../models/User');
const AppError = require('../utils/AppError');
const driveService = require('../services/driveService');

async function listFolders(req, res, next) {
  try {
    const folders = await Folder.find({ userId: req.user._id }).sort({
      createdAt: -1,
    });
    res.json({ success: true, folders });
  } catch (err) {
    next(err);
  }
}

async function createFolder(req, res, next) {
  try {
    const name = (req.body.name || '').trim();
    if (!name) throw new AppError('Folder name is required', 400);

    let driveFolderId;
    try {
      const user = await User.findById(req.user._id).select('+googleTokens');
      if (
        user?.driveConnected &&
        user.googleTokens?.refreshToken &&
        driveService.isGoogleConfigured()
      ) {
        let rootId = user.driveRootFolderId;
        if (!rootId) {
          rootId = await driveService.ensureAksharaRoot(user);
          user.driveRootFolderId = rootId;
          await user.save();
        }
        driveFolderId = await driveService.createFolder(user, name, rootId);
      }
    } catch (e) {
      console.warn('Drive folder create skipped:', e.message);
    }

    const folder = await Folder.create({
      userId: req.user._id,
      name,
      driveFolderId,
    });

    res.status(201).json({ success: true, folder });
  } catch (err) {
    next(err);
  }
}

async function updateFolder(req, res, next) {
  try {
    const name = (req.body.name || '').trim();
    if (!name) throw new AppError('Folder name is required', 400);

    const folder = await Folder.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { name },
      { new: true, runValidators: true }
    );
    if (!folder) throw new AppError('Folder not found', 404);

    res.json({ success: true, folder });
  } catch (err) {
    next(err);
  }
}

async function deleteFolder(req, res, next) {
  try {
    const folder = await Folder.findOneAndDelete({
      _id: req.params.id,
      userId: req.user._id,
    });
    if (!folder) throw new AppError('Folder not found', 404);

    await Document.deleteMany({ folderId: folder._id, userId: req.user._id });

    res.json({ success: true, message: 'Folder and its documents deleted' });
  } catch (err) {
    next(err);
  }
}

module.exports = { listFolders, createFolder, updateFolder, deleteFolder };
