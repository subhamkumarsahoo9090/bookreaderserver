const mongoose = require('mongoose');

const annotationSchema = new mongoose.Schema(
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
      required: true,
      index: true,
    },
    selectedText: { type: String, required: true, trim: true },
    color: {
      type: String,
      enum: ['yellow', 'green', 'blue', 'pink', 'purple'],
      default: 'yellow',
    },
    comment: { type: String, default: '', trim: true },
    startOffset: { type: Number, default: 0 },
    endOffset: { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Annotation', annotationSchema);
