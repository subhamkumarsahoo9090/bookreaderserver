const Note = require('../models/Note');
const Document = require('../models/Document');
const Folder = require('../models/Folder');
const AppError = require('../utils/AppError');

async function listNotes(req, res, next) {
  try {
    const filter = { userId: req.user._id };
    if (req.query.documentId) filter.documentId = req.query.documentId;
    if (req.query.folderId) filter.folderId = req.query.folderId;

    const notes = await Note.find(filter).sort({ updatedAt: -1 });
    res.json({ success: true, notes });
  } catch (err) {
    next(err);
  }
}

async function getNote(req, res, next) {
  try {
    const note = await Note.findOne({
      _id: req.params.id,
      userId: req.user._id,
    });
    if (!note) throw new AppError('Note not found', 404);
    res.json({ success: true, note });
  } catch (err) {
    next(err);
  }
}

async function createNote(req, res, next) {
  try {
    const { title, content, documentId, folderId, tags } = req.body;
    if (!title || !String(title).trim()) {
      throw new AppError('title is required', 400);
    }
    if (!content || !String(content).trim()) {
      throw new AppError('content is required', 400);
    }

    let resolvedFolderId = folderId || null;
    let resolvedDocumentId = documentId || null;

    if (resolvedDocumentId) {
      const doc = await Document.findOne({
        _id: resolvedDocumentId,
        userId: req.user._id,
      });
      if (!doc) throw new AppError('Document not found', 404);
      if (!resolvedFolderId) resolvedFolderId = doc.folderId;
    }
    if (resolvedFolderId) {
      const folder = await Folder.findOne({
        _id: resolvedFolderId,
        userId: req.user._id,
      });
      if (!folder) throw new AppError('Folder not found', 404);
    }

    const note = await Note.create({
      userId: req.user._id,
      title: String(title).trim(),
      content: String(content).trim(),
      documentId: resolvedDocumentId,
      folderId: resolvedFolderId,
      tags: Array.isArray(tags)
        ? tags.map((t) => String(t).trim()).filter(Boolean)
        : [],
    });

    res.status(201).json({ success: true, note });
  } catch (err) {
    next(err);
  }
}

async function updateNote(req, res, next) {
  try {
    const note = await Note.findOne({
      _id: req.params.id,
      userId: req.user._id,
    });
    if (!note) throw new AppError('Note not found', 404);

    if (req.body.title !== undefined) {
      const title = String(req.body.title).trim();
      if (!title) throw new AppError('title cannot be empty', 400);
      note.title = title;
    }
    if (req.body.content !== undefined) {
      const content = String(req.body.content).trim();
      if (!content) throw new AppError('content cannot be empty', 400);
      note.content = content;
    }
    if (Array.isArray(req.body.tags)) {
      note.tags = req.body.tags.map((t) => String(t).trim()).filter(Boolean);
    }
    if (req.body.documentId === null) {
      note.documentId = null;
    } else if (req.body.documentId !== undefined) {
      const doc = await Document.findOne({
        _id: req.body.documentId,
        userId: req.user._id,
      });
      if (!doc) throw new AppError('Document not found', 404);
      note.documentId = doc._id;
      note.folderId = doc.folderId;
    }
    if (req.body.folderId === null) {
      note.folderId = null;
    } else if (req.body.folderId !== undefined) {
      const folder = await Folder.findOne({
        _id: req.body.folderId,
        userId: req.user._id,
      });
      if (!folder) throw new AppError('Folder not found', 404);
      note.folderId = folder._id;
    }

    await note.save();
    res.json({ success: true, note });
  } catch (err) {
    next(err);
  }
}

async function deleteNote(req, res, next) {
  try {
    const note = await Note.findOneAndDelete({
      _id: req.params.id,
      userId: req.user._id,
    });
    if (!note) throw new AppError('Note not found', 404);
    res.json({ success: true, message: 'Note deleted' });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listNotes,
  getNote,
  createNote,
  updateNote,
  deleteNote,
};
