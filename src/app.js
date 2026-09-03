const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/authRoutes');
const folderRoutes = require('./routes/folderRoutes');
const documentRoutes = require('./routes/documentRoutes');
const vocabularyRoutes = require('./routes/vocabularyRoutes');
const noteRoutes = require('./routes/noteRoutes');
const progressRoutes = require('./routes/progressRoutes');
const annotationRoutes = require('./routes/annotationRoutes');
const flashcardRoutes = require('./routes/flashcardRoutes');
const classroomRoutes = require('./routes/classroomRoutes');
const libraryRoutes = require('./routes/libraryRoutes');
const { notFound, errorHandler } = require('./middleware/errorHandler');

const app = express();

app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'bookreaderserver' });
});

app.use('/api/auth', authRoutes);
app.use('/api/folders', folderRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/vocabulary', vocabularyRoutes);
app.use('/api/notes', noteRoutes);
app.use('/api/progress', progressRoutes);
app.use('/api/annotations', annotationRoutes);
app.use('/api/flashcards', flashcardRoutes);
app.use('/api/classrooms', classroomRoutes);
app.use('/api/library', libraryRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
