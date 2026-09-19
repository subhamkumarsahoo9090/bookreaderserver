const Folder = require('../models/Folder');
const Document = require('../models/Document');
const User = require('../models/User');
const AppError = require('../utils/AppError');
const driveService = require('../services/driveService');

async function collectDescendantIds(userId, rootId) {
  const ids = [rootId];
  for (let i = 0; i < ids.length; i += 1) {
    const children = await Folder.find({ userId, parentId: ids[i] }).select(
      '_id'
    );
    children.forEach((c) => ids.push(c._id));
  }
  return ids;
}

async function buildPath(userId, folder) {
  const path = [];
  let current = folder;
  const seen = new Set();
  while (current) {
    const id = String(current._id);
    if (seen.has(id)) break;
    seen.add(id);
    path.unshift({ _id: current._id, name: current.name });
    if (!current.parentId) break;
    current = await Folder.findOne({
      _id: current.parentId,
      userId,
    });
  }
  return path;
}

async function listFolders(req, res, next) {
  try {
    const filter = { userId: req.user._id };
    const { parentId } = req.query;

    if (parentId === 'root' || parentId === 'null') {
      filter.parentId = null;
    } else if (parentId) {
      const parent = await Folder.findOne({
        _id: parentId,
        userId: req.user._id,
      });
      if (!parent) throw new AppError('Parent folder not found', 404);
      filter.parentId = parentId;
    }
    // no parentId query → all folders (classroom / assign pickers)

    const folders = await Folder.find(filter).sort({ createdAt: -1 });
    res.json({ success: true, folders });
  } catch (err) {
    next(err);
  }
}

async function getFolder(req, res, next) {
  try {
    const folder = await Folder.findOne({
      _id: req.params.id,
      userId: req.user._id,
    });
    if (!folder) throw new AppError('Folder not found', 404);
    const path = await buildPath(req.user._id, folder);
    const children = await Folder.find({
      userId: req.user._id,
      parentId: folder._id,
    }).sort({ createdAt: -1 });
    res.json({ success: true, folder, path, children });
  } catch (err) {
    next(err);
  }
}

async function createFolder(req, res, next) {
  try {
    const name = (req.body.name || '').trim();
    if (!name) throw new AppError('Folder name is required', 400);

    let parent = null;
    let parentId = null;
    if (req.body.parentId) {
      parent = await Folder.findOne({
        _id: req.body.parentId,
        userId: req.user._id,
      });
      if (!parent) throw new AppError('Parent folder not found', 404);
      parentId = parent._id;
    }

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
        const driveParent = parent?.driveFolderId || rootId;
        driveFolderId = await driveService.createFolder(
          user,
          name,
          driveParent
        );
      }
    } catch (e) {
      console.warn('Drive folder create skipped:', e.message);
    }

    const folder = await Folder.create({
      userId: req.user._id,
      parentId,
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
    const folder = await Folder.findOne({
      _id: req.params.id,
      userId: req.user._id,
    });
    if (!folder) throw new AppError('Folder not found', 404);

    if (req.body.name !== undefined) {
      const name = String(req.body.name || '').trim();
      if (!name) throw new AppError('Folder name is required', 400);
      folder.name = name;
    }

    // Optional move into another folder
    if (req.body.parentId !== undefined) {
      const nextParent =
        req.body.parentId === null || req.body.parentId === ''
          ? null
          : String(req.body.parentId);

      if (nextParent) {
        if (nextParent === String(folder._id)) {
          throw new AppError('Folder cannot be its own parent', 400);
        }
        const parent = await Folder.findOne({
          _id: nextParent,
          userId: req.user._id,
        });
        if (!parent) throw new AppError('Parent folder not found', 404);

        const descendants = await collectDescendantIds(
          req.user._id,
          folder._id
        );
        if (descendants.some((id) => String(id) === nextParent)) {
          throw new AppError('Cannot move a folder into its descendant', 400);
        }
        folder.parentId = parent._id;
      } else {
        folder.parentId = null;
      }
    }

    await folder.save();
    res.json({ success: true, folder });
  } catch (err) {
    next(err);
  }
}

async function deleteFolder(req, res, next) {
  try {
    const folder = await Folder.findOne({
      _id: req.params.id,
      userId: req.user._id,
    });
    if (!folder) throw new AppError('Folder not found', 404);

    const ids = await collectDescendantIds(req.user._id, folder._id);
    await Document.deleteMany({
      folderId: { $in: ids },
      userId: req.user._id,
    });
    await Folder.deleteMany({ _id: { $in: ids }, userId: req.user._id });

    res.json({
      success: true,
      message: 'Folder, subfolders, and documents deleted',
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listFolders,
  getFolder,
  createFolder,
  updateFolder,
  deleteFolder,
};
