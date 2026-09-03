const mongoose = require('mongoose');

const vocabularySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    documentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Document',
      default: null,
    },
    folderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Folder',
      default: null,
    },
    type: {
      type: String,
      enum: ['word', 'phrase', 'sentence'],
      default: 'word',
      index: true,
    },
    text: {
      type: String,
      required: true,
      trim: true,
    },
    word: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    phonetic: {
      type: String,
      trim: true,
    },
    definition: {
      type: String,
      required: true,
      trim: true,
    },
    exampleSentence: {
      type: String,
      trim: true,
    },
    exampleSentences: {
      type: [String],
      default: [],
    },
    // SM-2 spaced repetition
    easeFactor: { type: Number, default: 2.5 },
    interval: { type: Number, default: 0 },
    repetitions: { type: Number, default: 0 },
    nextReviewAt: { type: Date, default: Date.now },
    lastReviewedAt: { type: Date },
    savedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: false }
);

vocabularySchema.index({ userId: 1, word: 1, type: 1 }, { unique: true });
vocabularySchema.index({ userId: 1, nextReviewAt: 1 });

module.exports = mongoose.model('Vocabulary', vocabularySchema);
