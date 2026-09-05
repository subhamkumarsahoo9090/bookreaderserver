const Document = require('../models/Document');
const Folder = require('../models/Folder');
const User = require('../models/User');
const AppError = require('../utils/AppError');
const driveService = require('../services/driveService');
const {
  runOcrOnBuffer,
  inferFileType,
  countWords,
  normalizeOcrLang,
} = require('../services/ocrService');

function textPreview(text) {
  return String(text || '').slice(0, 500);
}

async function loadUserWithDrive(userId) {
  return User.findById(userId).select('+googleTokens');
}

async function saveTextPreferDrive(user, {
  title,
  text,
  parentDriveFolderId,
  existingDriveFileId,
}) {
  if (
    !user.driveConnected ||
    !user.googleTokens?.refreshToken ||
    !driveService.isGoogleConfigured()
  ) {
    return { storage: 'mongo', driveTextFileId: null, text };
  }

  try {
    let rootId = user.driveRootFolderId;
    if (!rootId) {
      rootId = await driveService.ensureAksharaRoot(user);
      user.driveRootFolderId = rootId;
      await user.save();
    }
    const parentId = parentDriveFolderId || rootId;
    const safeName = `${String(title || 'document')
      .replace(/[\\/:*?"<>|]/g, '_')
      .slice(0, 80)}.md`;

    if (existingDriveFileId) {
      await driveService.updateTextFile(user, existingDriveFileId, text);
      return {
        storage: 'drive',
        driveTextFileId: existingDriveFileId,
        text: '',
      };
    }

    const fileId = await driveService.saveTextFile(user, {
      name: safeName,
      content: text,
      parentId,
    });
    return { storage: 'drive', driveTextFileId: fileId, text: '' };
  } catch (err) {
    console.warn('Drive save failed, falling back to Mongo:', err.message);
    return { storage: 'mongo', driveTextFileId: null, text };
  }
}

async function resolveDocumentText(user, document) {
  if (
    document.storage === 'drive' &&
    document.driveTextFileId &&
    user.driveConnected
  ) {
    try {
      const withTokens = await loadUserWithDrive(user._id);
      const text = await driveService.readTextFile(
        withTokens,
        document.driveTextFileId
      );
      return text;
    } catch (err) {
      console.warn('Drive read failed:', err.message);
      if (document.extractedText) return document.extractedText;
      throw new AppError(
        'Could not load text from Google Drive. Reconnect Drive or check permissions.',
        502
      );
    }
  }
  return document.extractedText || '';
}

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

    const ocrLang = normalizeOcrLang(
      req.body.ocrLang || req.body.language || 'auto'
    );
    const { extractedText, wordCount, language } = await runOcrOnBuffer(
      req.file.buffer,
      fileType,
      ocrLang
    );

    const driveUser = await loadUserWithDrive(req.user._id);
    const saved = await saveTextPreferDrive(driveUser, {
      title: String(title).trim(),
      text: extractedText,
      parentDriveFolderId: folder.driveFolderId,
    });

    const document = await Document.create({
      userId: req.user._id,
      folderId,
      title: String(title).trim(),
      fileType,
      language,
      extractedText: saved.storage === 'drive' ? '' : saved.text,
      textPreview: textPreview(extractedText),
      storage: saved.storage,
      driveTextFileId: saved.driveTextFileId || undefined,
      wordCount,
    });

    const out = document.toObject();
    out.extractedText = extractedText;
    res.status(201).json({ success: true, document: out });
  } catch (err) {
    next(err);
  }
}

async function recognizeSnippet(req, res, next) {
  try {
    if (!req.file) {
      throw new AppError('File is required (field name: file)', 400);
    }
    const ocrLang = normalizeOcrLang(
      req.body.ocrLang || req.body.language || 'auto'
    );
    const { extractedText, wordCount } = await runOcrOnBuffer(
      req.file.buffer,
      'image',
      ocrLang
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

    const text = await resolveDocumentText(req.user, document);
    const out = document.toObject();
    out.extractedText = text;
    res.json({ success: true, document: out });
  } catch (err) {
    next(err);
  }
}

async function updateDocument(req, res, next) {
  try {
    const document = await Document.findOne({
      _id: req.params.id,
      userId: req.user._id,
    });
    if (!document) throw new AppError('Document not found', 404);

    if (req.body.title !== undefined) {
      const title = String(req.body.title).trim();
      if (!title) throw new AppError('title cannot be empty', 400);
      document.title = title;
    }
    if (req.body.folderId !== undefined) {
      const folder = await Folder.findOne({
        _id: req.body.folderId,
        userId: req.user._id,
      });
      if (!folder) throw new AppError('Folder not found', 404);
      document.folderId = req.body.folderId;
    }
    if (req.body.language !== undefined) {
      document.language = String(req.body.language).trim();
    }

    if (req.body.extractedText !== undefined) {
      const extractedText = String(req.body.extractedText);
      const wordCount =
        req.body.wordCount !== undefined
          ? Number(req.body.wordCount)
          : countWords(extractedText);

      const driveUser = await loadUserWithDrive(req.user._id);
      const folder = await Folder.findById(document.folderId);
      const saved = await saveTextPreferDrive(driveUser, {
        title: document.title,
        text: extractedText,
        parentDriveFolderId: folder?.driveFolderId,
        existingDriveFileId: document.driveTextFileId,
      });

      document.wordCount = wordCount;
      document.textPreview = textPreview(extractedText);
      document.storage = saved.storage;
      if (saved.driveTextFileId) {
        document.driveTextFileId = saved.driveTextFileId;
      }
      document.extractedText =
        saved.storage === 'drive' ? '' : extractedText;
    }

    await document.save();
    const out = document.toObject();
    if (req.body.extractedText !== undefined) {
      out.extractedText = String(req.body.extractedText);
    } else {
      out.extractedText = await resolveDocumentText(req.user, document);
    }
    res.json({ success: true, document: out });
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
    const { folderId, title, extractedText, fileType, language } = req.body;
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

    const driveUser = await loadUserWithDrive(req.user._id);
    const saved = await saveTextPreferDrive(driveUser, {
      title: String(title).trim(),
      text,
      parentDriveFolderId: folder.driveFolderId,
    });

    const document = await Document.create({
      userId: req.user._id,
      folderId,
      title: String(title).trim(),
      fileType: ft,
      language: language || 'eng',
      extractedText: saved.storage === 'drive' ? '' : text,
      textPreview: textPreview(text),
      storage: saved.storage,
      driveTextFileId: saved.driveTextFileId || undefined,
      wordCount: countWords(text),
    });

    const out = document.toObject();
    out.extractedText = text;
    res.status(201).json({ success: true, document: out });
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
