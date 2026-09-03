const mongoose = require('mongoose');

const classroomSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    teacherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    inviteCode: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },
    memberIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    folderIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Folder',
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model('Classroom', classroomSchema);
