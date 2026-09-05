const SharedBook = require('../models/SharedBook');
const AppError = require('../utils/AppError');
const {
  runOcrOnBuffer,
  inferFileType,
} = require('../services/ocrService');

function preview(text) {
  return String(text || '').slice(0, 500);
}

async function listPublished(req, res, next) {
  try {
    const q = { published: true };
    if (req.query.category) q.category = req.query.category;
    const books = await SharedBook.find(q)
      .select('-extractedText')
      .sort({ createdAt: -1 });
    res.json({ success: true, books });
  } catch (err) {
    next(err);
  }
}

async function getPublished(req, res, next) {
  try {
    const book = await SharedBook.findOne({
      _id: req.params.id,
      published: true,
    });
    if (!book) throw new AppError('Book not found', 404);
    res.json({ success: true, book });
  } catch (err) {
    next(err);
  }
}

async function adminList(req, res, next) {
  try {
    const books = await SharedBook.find()
      .select('-extractedText')
      .sort({ createdAt: -1 });
    res.json({ success: true, books });
  } catch (err) {
    next(err);
  }
}

async function adminUpload(req, res, next) {
  try {
    if (!req.file) throw new AppError('File is required (field: file)', 400);
    const title = (req.body.title || req.file.originalname || 'Untitled').trim();
    const fileType = inferFileType(
      req.file.mimetype,
      req.body.fileType,
      req.file.originalname
    );
    if (!fileType || fileType === 'audio') {
      throw new AppError('Unsupported file type for shared library', 400);
    }

    const ocrLang = req.body.ocrLang || req.body.language || 'eng+hin+ori';
    const { extractedText, wordCount } = await runOcrOnBuffer(
      req.file.buffer,
      fileType,
      ocrLang
    );

    const book = await SharedBook.create({
      title,
      description: (req.body.description || '').trim(),
      category: (req.body.category || 'General').trim(),
      tags: req.body.tags
        ? String(req.body.tags)
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean)
        : [],
      fileType,
      language: ocrLang,
      extractedText,
      textPreview: preview(extractedText),
      wordCount,
      published: req.body.published !== 'false',
      uploadedBy: req.user._id,
    });

    res.status(201).json({
      success: true,
      book: {
        ...book.toObject(),
        extractedText: undefined,
      },
    });
  } catch (err) {
    next(err);
  }
}

async function adminUpdate(req, res, next) {
  try {
    const book = await SharedBook.findById(req.params.id);
    if (!book) throw new AppError('Book not found', 404);

    ['title', 'description', 'category'].forEach((k) => {
      if (req.body[k] !== undefined) book[k] = String(req.body[k]).trim();
    });
    if (req.body.published !== undefined) {
      book.published =
        req.body.published === true || req.body.published === 'true';
    }
    if (req.body.tags !== undefined) {
      book.tags = Array.isArray(req.body.tags)
        ? req.body.tags
        : String(req.body.tags)
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean);
    }
    await book.save();
    res.json({
      success: true,
      book: { ...book.toObject(), extractedText: undefined },
    });
  } catch (err) {
    next(err);
  }
}

async function adminDelete(req, res, next) {
  try {
    const book = await SharedBook.findByIdAndDelete(req.params.id);
    if (!book) throw new AppError('Book not found', 404);
    res.json({ success: true, message: 'Book deleted' });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listPublished,
  getPublished,
  adminList,
  adminUpload,
  adminUpdate,
  adminDelete,
};
