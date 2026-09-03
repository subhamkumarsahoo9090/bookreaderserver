const Document = require('../models/Document');
const Folder = require('../models/Folder');
const AppError = require('../utils/AppError');
const {
  runOcrOnBuffer,
  inferFileType,
  countWords,
} = require('../services/ocrService');

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

    const fileType = inferFileType(
      req.file.mimetype,
      req.body.fileType,
      req.file.originalname
    );
    if (!fileType) {
      throw new AppError(
        'Could not determine fileType (image, pdf, txt, docx, rtf, epub)',
        400
      );
    }

    const { extractedText, wordCount } = await runOcrOnBuffer(
      req.file.buffer,
      fileType
    );

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

/** OCR a handwriting / image snippet without saving a document */
async function recognizeSnippet(req, res, next) {
  try {
    if (!req.file) {
      throw new AppError('File is required (field name: file)', 400);
    }
    const { extractedText, wordCount } = await runOcrOnBuffer(
      req.file.buffer,
      'image'
    );
    res.json({ success: true, text: extractedText, wordCount });
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
    if (req.body.extractedText !== undefined) {
      const extractedText = String(req.body.extractedText);
      updates.extractedText = extractedText;
      updates.wordCount =
        req.body.wordCount !== undefined
          ? Number(req.body.wordCount)
          : countWords(extractedText);
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

async function createFromText(req, res, next) {
  try {
    const { folderId, title, extractedText, fileType } = req.body;
    if (!folderId) throw new AppError('folderId is required', 400);
    if (!title || !String(title).trim()) {
      throw new AppError('title is required', 400);
    }
    const text = String(extractedText || '').trim();
    if (!text) throw new AppError('extractedText is required', 400);

    const folder = await Folder.findOne({
      _id: folderId,
      userId: req.user._id,
    });
    if (!folder) throw new AppError('Folder not found', 404);

    const allowed = ['txt', 'audio', 'image', 'pdf', 'docx', 'rtf', 'epub'];
    const ft = allowed.includes(fileType) ? fileType : 'txt';

    const document = await Document.create({
      userId: req.user._id,
      folderId,
      title: String(title).trim(),
      fileType: ft,
      extractedText: text,
      wordCount: countWords(text),
    });

    res.status(201).json({ success: true, document });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  processDocument,
  recognizeSnippet,
  createFromText,
  listDocuments,
  getDocument,
  updateDocument,
  deleteDocument,
};
