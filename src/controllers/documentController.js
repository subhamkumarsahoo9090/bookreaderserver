const Document = require('../models/Document');
const Folder = require('../models/Folder');
const AppError = require('../utils/AppError');
const { runOcrOnBuffer, inferFileType } = require('../services/ocrService');

async function processDocument(req, res, next) {
  try {
    if (!req.file) {
      throw new AppError('File is required (field name: file)', 400);
    }

    const { folderId, title } = req.body;
    if (!folderId) throw new AppError('folderId is required', 400);
    if (!title || !String(title).trim()) {
      throw new AppError('title is required', 400);
    }

    const folder = await Folder.findOne({
      _id: folderId,
      userId: req.user._id,
    });
    if (!folder) throw new AppError('Folder not found', 404);

    const fileType = inferFileType(req.file.mimetype, req.body.fileType);
    if (!fileType) {
      throw new AppError('Could not determine fileType (image or pdf)', 400);
    }

    // 1. OCR / extract text from in-memory buffer only
    const { extractedText, wordCount } = await runOcrOnBuffer(
      req.file.buffer,
      fileType
    );

    // 2. Persist text only — buffer is discarded when request ends
    const document = await Document.create({
      userId: req.user._id,
      folderId,
      title: String(title).trim(),
      fileType,
      extractedText,
      wordCount,
    });

    res.status(201).json({ success: true, document });
  } catch (err) {
    next(err);
  }
}

async function listDocuments(req, res, next) {
  try {
    const filter = { userId: req.user._id };
    if (req.query.folderId) {
      filter.folderId = req.query.folderId;
    }

    const documents = await Document.find(filter)
      .select('-extractedText')
      .sort({ createdAt: -1 });

    res.json({ success: true, documents });
  } catch (err) {
    next(err);
  }
}

async function getDocument(req, res, next) {
  try {
    const document = await Document.findOne({
      _id: req.params.id,
      userId: req.user._id,
    });
    if (!document) throw new AppError('Document not found', 404);

    res.json({ success: true, document });
  } catch (err) {
    next(err);
  }
}

async function updateDocument(req, res, next) {
  try {
    const updates = {};
    if (req.body.title !== undefined) {
      const title = String(req.body.title).trim();
      if (!title) throw new AppError('title cannot be empty', 400);
      updates.title = title;
    }
    if (req.body.folderId !== undefined) {
      const folder = await Folder.findOne({
        _id: req.body.folderId,
        userId: req.user._id,
      });
      if (!folder) throw new AppError('Folder not found', 404);
      updates.folderId = req.body.folderId;
    }

    if (!Object.keys(updates).length) {
      throw new AppError('No valid fields to update', 400);
    }

    const document = await Document.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      updates,
      { new: true, runValidators: true }
    );
    if (!document) throw new AppError('Document not found', 404);

    res.json({ success: true, document });
  } catch (err) {
    next(err);
  }
}

async function deleteDocument(req, res, next) {
  try {
    const document = await Document.findOneAndDelete({
      _id: req.params.id,
      userId: req.user._id,
    });
    if (!document) throw new AppError('Document not found', 404);

    res.json({ success: true, message: 'Document deleted' });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  processDocument,
  listDocuments,
  getDocument,
  updateDocument,
  deleteDocument,
};
