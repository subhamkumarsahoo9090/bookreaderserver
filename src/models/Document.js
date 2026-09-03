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
    title: {
      type: String,
      required: true,
      trim: true,
    },
    fileType: {
      type: String,
      enum: ['image', 'pdf', 'txt', 'docx', 'rtf', 'epub', 'audio'],
      required: true,
    },
    extractedText: {
      type: String,
      required: true,
    },
    wordCount: {
      type: Number,
      default: 0,
    },
    isPublic: { type: Boolean, default: false },
    shareSlug: { type: String, trim: true, sparse: true, unique: true },
  },
  { timestamps: true }
);

documentSchema.index({ title: 'text', extractedText: 'text' });

module.exports = mongoose.model('Document', documentSchema);
