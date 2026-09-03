const crypto = require('crypto');
const ReadingProgress = require('../models/ReadingProgress');
const Document = require('../models/Document');
const AppError = require('../utils/AppError');

async function upsertProgress(req, res, next) {
  try {
    const { documentId, charOffset, percent } = req.body;
    if (!documentId) throw new AppError('documentId is required', 400);

    const doc = await Document.findOne({
      _id: documentId,
      userId: req.user._id,
    });
    if (!doc) throw new AppError('Document not found', 404);

    const pct = Math.min(100, Math.max(0, Number(percent) || 0));
    const progress = await ReadingProgress.findOneAndUpdate(
      { userId: req.user._id, documentId },
      {
        userId: req.user._id,
        documentId,
        charOffset: Number(charOffset) || 0,
        percent: pct,
        lastReadAt: new Date(),
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    req.user.bumpStreak();
    await req.user.save();

    res.json({
      success: true,
      progress,
      streak: req.user.streak,
    });
  } catch (err) {
    next(err);
  }
}

async function getProgress(req, res, next) {
  try {
    const progress = await ReadingProgress.findOne({
      userId: req.user._id,
      documentId: req.params.documentId,
    });
    res.json({ success: true, progress: progress || null });
  } catch (err) {
    next(err);
  }
}

async function listProgress(req, res, next) {
  try {
    const items = await ReadingProgress.find({ userId: req.user._id })
      .sort({ lastReadAt: -1 })
      .limit(50)
      .populate('documentId', 'title wordCount folderId');
    res.json({ success: true, progress: items, streak: req.user.streak });
  } catch (err) {
    next(err);
  }
}

function makeSlug() {
  return crypto.randomBytes(4).toString('hex');
}

async function toggleShare(req, res, next) {
  try {
    const doc = await Document.findOne({
      _id: req.params.id,
      userId: req.user._id,
    });
    if (!doc) throw new AppError('Document not found', 404);

    const makePublic = req.body.isPublic !== false;
    doc.isPublic = makePublic;
    if (makePublic && !doc.shareSlug) doc.shareSlug = makeSlug();
    if (!makePublic) doc.shareSlug = undefined;
    await doc.save();

    res.json({
      success: true,
      document: doc,
      shareUrl: doc.isPublic ? `/library/${doc.shareSlug}` : null,
    });
  } catch (err) {
    next(err);
  }
}

async function getPublicDocument(req, res, next) {
  try {
    const doc = await Document.findOne({
      shareSlug: req.params.slug,
      isPublic: true,
    }).select('title extractedText wordCount fileType createdAt shareSlug');
    if (!doc) throw new AppError('Shared document not found', 404);
    res.json({ success: true, document: doc });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  upsertProgress,
  getProgress,
  listProgress,
  toggleShare,
  getPublicDocument,
};
