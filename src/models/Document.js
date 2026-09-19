const mongoose = require('mongoose');

const documentSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    folderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Folder',
      required: true,
      index: true,
    },
    title: { type: String, required: true, trim: true },
    fileType: {
      type: String,
      enum: ['image', 'pdf', 'txt', 'docx', 'rtf', 'epub', 'audio'],
      required: true,
    },
    language: { type: String, default: 'eng', trim: true },
    // Prefer Drive; keep Mongo text only as fallback / legacy / short preview
    extractedText: { type: String, default: '' },
    textPreview: { type: String, default: '', maxlength: 500 },
    storage: {
      type: String,
      enum: ['mongo', 'drive'],
      default: 'mongo',
    },
    driveTextFileId: { type: String },
    driveOriginalFileId: { type: String },
    wordCount: { type: Number, default: 0 },
    isPublic: { type: Boolean, default: false },
    shareSlug: { type: String, trim: true, sparse: true, unique: true },
  },
  { timestamps: true }
);

documentSchema.index(
  { title: 'text', textPreview: 'text' },
  {
    // Avoid colliding with our OCR `language` field (eng / eng+hin+ori).
    // MongoDB text indexes treat a field named `language` as the stemmer override.
    default_language: 'none',
    language_override: 'searchLang',
  }
);

module.exports = mongoose.model('Document', documentSchema);
