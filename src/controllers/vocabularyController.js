const Vocabulary = require('../models/Vocabulary');
const Document = require('../models/Document');
const AppError = require('../utils/AppError');

async function listVocabulary(req, res, next) {
  try {
    const filter = { userId: req.user._id };
    if (req.query.documentId) {
      filter.documentId = req.query.documentId;
    }

    const words = await Vocabulary.find(filter).sort({ savedAt: -1 });
    res.json({ success: true, vocabulary: words });
  } catch (err) {
    next(err);
  }
}

async function saveWord(req, res, next) {
  try {
    const { word, phonetic, definition, exampleSentence, documentId } =
      req.body;

    if (!word || !String(word).trim()) {
      throw new AppError('word is required', 400);
    }
    if (!definition || !String(definition).trim()) {
      throw new AppError('definition is required', 400);
    }

    if (documentId) {
      const doc = await Document.findOne({
        _id: documentId,
        userId: req.user._id,
      });
      if (!doc) throw new AppError('Document not found', 404);
    }

    const entry = await Vocabulary.findOneAndUpdate(
      { userId: req.user._id, word: String(word).trim().toLowerCase() },
      {
        userId: req.user._id,
        word: String(word).trim().toLowerCase(),
        phonetic,
        definition: String(definition).trim(),
        exampleSentence,
        documentId: documentId || undefined,
        savedAt: new Date(),
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    res.status(201).json({ success: true, vocabulary: entry });
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

module.exports = { listVocabulary, saveWord, deleteWord };
