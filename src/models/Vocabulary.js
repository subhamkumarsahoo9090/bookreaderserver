const mongoose = require('mongoose');

const vocabularySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    documentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Document',
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
    savedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: false }
);

vocabularySchema.index({ userId: 1, word: 1 }, { unique: true });

module.exports = mongoose.model('Vocabulary', vocabularySchema);
