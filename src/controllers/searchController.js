const Document = require('../models/Document');
const Note = require('../models/Note');
const Vocabulary = require('../models/Vocabulary');
const Folder = require('../models/Folder');

async function searchLibrary(req, res, next) {
  try {
    const q = String(req.query.q || '').trim();
    if (!q || q.length < 2) {
      return res.json({
        success: true,
        documents: [],
        notes: [],
        vocabulary: [],
      });
    }

    const userId = req.user._id;
    const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');

    const [documents, notes, vocabulary] = await Promise.all([
      Document.find({
        userId,
        $or: [{ title: regex }, { extractedText: regex }],
      })
        .select('title wordCount folderId fileType createdAt')
        .limit(20),
      Note.find({
        userId,
        $or: [{ title: regex }, { content: regex }],
      })
        .select('title content documentId updatedAt')
        .limit(20),
      Vocabulary.find({
        userId,
        $or: [{ text: regex }, { word: regex }, { definition: regex }],
      })
        .select('text word type definition documentId')
        .limit(20),
    ]);

    res.json({ success: true, documents, notes, vocabulary, q });
  } catch (err) {
    next(err);
  }
}

async function exportMarkdown(req, res, next) {
  try {
    const type = req.query.type || 'all';
    const userId = req.user._id;
    const parts = [`# BookReader export\n`, `_Generated ${new Date().toISOString()}_\n`];

    if (type === 'notes' || type === 'all') {
      const notes = await Note.find({ userId }).sort({ updatedAt: -1 });
      parts.push(`\n## Notes\n`);
      for (const n of notes) {
        parts.push(`### ${n.title}\n\n${n.content}\n`);
      }
    }

    if (type === 'vocab' || type === 'vocabulary' || type === 'all') {
      const vocab = await Vocabulary.find({ userId }).sort({ savedAt: -1 });
      parts.push(`\n## Vocabulary\n`);
      for (const v of vocab) {
        parts.push(
          `- **${v.text || v.word}** (${v.type || 'word'}): ${v.definition}\n`
        );
      }
    }

    if (type === 'documents' || type === 'all') {
      const docs = await Document.find({ userId })
        .select('title extractedText wordCount')
        .sort({ updatedAt: -1 })
        .limit(50);
      parts.push(`\n## Documents\n`);
      for (const d of docs) {
        parts.push(`### ${d.title}\n\n${d.extractedText.slice(0, 5000)}\n\n---\n`);
      }
    }

    const markdown = parts.join('\n');
    res.json({ success: true, markdown, filename: `bookreader-export-${type}.md` });
  } catch (err) {
    next(err);
  }
}

async function listPublicLibrary(req, res, next) {
  try {
    const docs = await Document.find({ isPublic: true })
      .select('title wordCount shareSlug fileType createdAt')
      .sort({ createdAt: -1 })
      .limit(40);
    const folders = await Folder.find({ isPublic: true })
      .select('name shareSlug createdAt')
      .limit(20);
    res.json({ success: true, documents: docs, folders });
  } catch (err) {
    next(err);
  }
}

module.exports = { searchLibrary, exportMarkdown, listPublicLibrary };
