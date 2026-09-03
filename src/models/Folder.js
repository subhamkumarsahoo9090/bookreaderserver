const mongoose = require('mongoose');

const folderSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    isPublic: { type: Boolean, default: false },
    shareSlug: { type: String, trim: true, sparse: true, unique: true },
  },
  { timestamps: { createdAt: true, updatedAt: true } }
);

folderSchema.index({ userId: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('Folder', folderSchema);
