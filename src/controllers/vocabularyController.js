const Vocabulary = require('../models/Vocabulary');
const Document = require('../models/Document');
const Folder = require('../models/Folder');
const AppError = require('../utils/AppError');

function inferType(text, explicit) {
  if (explicit && ['word', 'phrase', 'sentence'].includes(explicit)) {
    return explicit;
  }
  const t = String(text || '').trim();
  if (!t.includes(' ')) return 'word';
  if (/[.!?]$/.test(t) || t.split(/\s+/).length > 6) return 'sentence';
  return 'phrase';
}

async function listVocabulary(req, res, next) {
  try {
    const filter = { userId: req.user._id };
    if (req.query.documentId === 'null' || req.query.standalone === '1') {
      filter.$or = [{ documentId: null }, { documentId: { $exists: false } }];
    } else if (req.query.documentId) {
      filter.documentId = req.query.documentId;
    }
    if (req.query.folderId) filter.folderId = req.query.folderId;
    if (req.query.type) filter.type = req.query.type;
    if (req.query.linked === '1') {
      filter.documentId = { $ne: null };
    }

    const words = await Vocabulary.find(filter).sort({ savedAt: -1 });
    res.json({ success: true, vocabulary: words });
  } catch (err) {
    next(err);
  }
}

async function saveWord(req, res, next) {
  try {
    const {
      word,
      text,
      phonetic,
      definition,
      exampleSentence,
      exampleSentences,
      documentId,
      folderId,
      type,
    } = req.body;

    const rawText = String(text || word || '').trim();
    if (!rawText) throw new AppError('text (or word) is required', 400);
    if (!definition || !String(definition).trim()) {
      throw new AppError('definition is required', 400);
    }

    const snippetType = inferType(rawText, type);
    const normalizedKey = rawText.toLowerCase();

    let resolvedFolderId = folderId || null;
    let resolvedDocumentId =
      documentId === null || documentId === ''
        ? null
        : documentId || undefined;

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

    const examples = Array.isArray(exampleSentences)
      ? exampleSentences.filter((s) => typeof s === 'string' && s.trim())
      : exampleSentence
        ? [exampleSentence]
        : [];

    const entry = await Vocabulary.findOneAndUpdate(
      {
        userId: req.user._id,
        word: normalizedKey,
        type: snippetType,
      },
      {
        userId: req.user._id,
        text: rawText,
        word: normalizedKey,
        type: snippetType,
        phonetic,
        definition: String(definition).trim(),
        exampleSentence: examples[0] || exampleSentence,
        exampleSentences: examples,
        documentId: resolvedDocumentId === undefined ? undefined : resolvedDocumentId,
        folderId: resolvedFolderId,
        savedAt: new Date(),
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    res.status(201).json({ success: true, vocabulary: entry });
  } catch (err) {
    next(err);
  }
}

async function updateWord(req, res, next) {
  try {
    const entry = await Vocabulary.findOne({
      _id: req.params.id,
      userId: req.user._id,
    });
    if (!entry) throw new AppError('Vocabulary entry not found', 404);

    const {
      definition,
      phonetic,
      exampleSentence,
      exampleSentences,
      type,
      text,
      documentId,
      folderId,
      standalone,
    } = req.body;

    if (definition !== undefined) {
      const d = String(definition).trim();
      if (!d) throw new AppError('definition cannot be empty', 400);
      entry.definition = d;
    }
    if (phonetic !== undefined) entry.phonetic = phonetic;
    if (exampleSentence !== undefined) entry.exampleSentence = exampleSentence;
    if (Array.isArray(exampleSentences)) {
      entry.exampleSentences = exampleSentences.filter(
        (s) => typeof s === 'string' && s.trim()
      );
      if (!entry.exampleSentence && entry.exampleSentences[0]) {
        entry.exampleSentence = entry.exampleSentences[0];
      }
    }
    if (type && ['word', 'phrase', 'sentence'].includes(type)) {
      entry.type = type;
    }
    if (text !== undefined) {
      const t = String(text).trim();
      if (!t) throw new AppError('text cannot be empty', 400);
      entry.text = t;
      entry.word = t.toLowerCase();
    }

    if (standalone === true || documentId === null) {
      entry.documentId = null;
    } else if (documentId !== undefined) {
      const doc = await Document.findOne({
        _id: documentId,
        userId: req.user._id,
      });
      if (!doc) throw new AppError('Document not found', 404);
      entry.documentId = doc._id;
      entry.folderId = doc.folderId;
    }

    if (folderId === null) {
      entry.folderId = null;
    } else if (folderId !== undefined) {
      const folder = await Folder.findOne({
        _id: folderId,
        userId: req.user._id,
      });
      if (!folder) throw new AppError('Folder not found', 404);
      entry.folderId = folder._id;
    }

    await entry.save();
    res.json({ success: true, vocabulary: entry });
  } catch (err) {
    next(err);
  }
}

async function deleteWord(req, res, next) {
  try {
    const entry = await Vocabulary.findOneAndDelete({
      _id: req.params.id,
      userId: req.user._id,
    });
    if (!entry) throw new AppError('Vocabulary entry not found', 404);

    res.json({ success: true, message: 'Word removed from vocabulary' });
  } catch (err) {
    next(err);
  }
}

module.exports = { listVocabulary, saveWord, updateWord, deleteWord };
