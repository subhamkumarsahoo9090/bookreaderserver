const Annotation = require('../models/Annotation');
const Document = require('../models/Document');
const AppError = require('../utils/AppError');

async function listAnnotations(req, res, next) {
  try {
    const filter = { userId: req.user._id };
    if (req.query.documentId) filter.documentId = req.query.documentId;
    const annotations = await Annotation.find(filter).sort({ createdAt: -1 });
    res.json({ success: true, annotations });
  } catch (err) {
    next(err);
  }
}

async function createAnnotation(req, res, next) {
  try {
    const {
      documentId,
      selectedText,
      color,
      comment,
      startOffset,
      endOffset,
    } = req.body;
    if (!documentId) throw new AppError('documentId is required', 400);
    if (!selectedText || !String(selectedText).trim()) {
      throw new AppError('selectedText is required', 400);
    }

    const doc = await Document.findOne({
      _id: documentId,
      userId: req.user._id,
    });
    if (!doc) throw new AppError('Document not found', 404);

    const annotation = await Annotation.create({
      userId: req.user._id,
      documentId,
      selectedText: String(selectedText).trim(),
      color: color || 'yellow',
      comment: comment || '',
      startOffset: Number(startOffset) || 0,
      endOffset: Number(endOffset) || 0,
    });

    res.status(201).json({ success: true, annotation });
  } catch (err) {
    next(err);
  }
}

async function updateAnnotation(req, res, next) {
  try {
    const annotation = await Annotation.findOne({
      _id: req.params.id,
      userId: req.user._id,
    });
    if (!annotation) throw new AppError('Annotation not found', 404);

    if (req.body.color) annotation.color = req.body.color;
    if (req.body.comment !== undefined) annotation.comment = req.body.comment;
    await annotation.save();
    res.json({ success: true, annotation });
  } catch (err) {
    next(err);
  }
}

async function deleteAnnotation(req, res, next) {
  try {
    const annotation = await Annotation.findOneAndDelete({
      _id: req.params.id,
      userId: req.user._id,
    });
    if (!annotation) throw new AppError('Annotation not found', 404);
    res.json({ success: true, message: 'Annotation deleted' });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listAnnotations,
  createAnnotation,
  updateAnnotation,
  deleteAnnotation,
};
