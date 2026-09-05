const mongoose = require('mongoose');

const sharedBookSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '', trim: true },
    category: { type: String, default: 'General', trim: true },
    tags: { type: [String], default: [] },
    fileType: {
      type: String,
      enum: ['image', 'pdf', 'txt', 'docx', 'rtf', 'epub'],
      required: true,
    },
    language: { type: String, default: 'eng' },
    // Shared catalog text (admin books); kept so all users can read without Drive
    extractedText: { type: String, required: true },
    textPreview: { type: String, default: '' },
    wordCount: { type: Number, default: 0 },
    published: { type: Boolean, default: true },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true }
);

sharedBookSchema.index({ title: 'text', description: 'text', category: 'text' });

module.exports = mongoose.model('SharedBook', sharedBookSchema);
