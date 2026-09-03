# Book Reader Server

Node.js / Express backend for a reading app that extracts text from many file types **in memory**, stores text in MongoDB, and supports folders, vocabulary snippets, notes, and user themes.

## Stack

- Express + Multer (`memoryStorage`)
- MongoDB + Mongoose
- JWT auth
- OCR: Tesseract.js (default) or Google Cloud Vision
- Parsers: `pdf-parse`, `mammoth` (docx), JSZip (epub), plain text / RTF strip

## Setup

```bash
npm install
cp .env.example .env
# edit MONGODB_URI and JWT_SECRET
npm run dev
```

Server: `http://localhost:5000`

## API

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/auth/register` | — | Register |
| POST | `/api/auth/login` | — | Login |
| GET | `/api/auth/me` | JWT | Current user (+ settings) |
| PATCH | `/api/auth/settings` | JWT | `{ theme }` — paper \| night \| sepia \| contrast |
| GET/POST | `/api/folders` | JWT | List / create folders |
| PATCH/DELETE | `/api/folders/:id` | JWT | Rename / delete folder |
| POST | `/api/documents/process` | JWT | Upload → extract text → save |
| POST | `/api/documents/recognize` | JWT | Image/handwriting OCR → text only |
| GET | `/api/documents` | JWT | List docs (`?folderId=`) |
| GET/PATCH/DELETE | `/api/documents/:id` | JWT | Get / update (title, folderId, **extractedText**) / delete |
| GET/POST | `/api/vocabulary` | JWT | List / save word\|phrase\|sentence |
| PATCH/DELETE | `/api/vocabulary/:id` | JWT | Move/update / delete |
| GET/POST | `/api/notes` | JWT | List / create notes |
| GET/PATCH/DELETE | `/api/notes/:id` | JWT | Get / update / delete note |

### Process document (multipart)

`file`, `folderId`, `title`, optional `fileType` (`image` \| `pdf` \| `txt` \| `docx` \| `rtf` \| `epub`).

### Vocabulary

Body supports `text`/`word`, `type`, `definition`, `exampleSentences[]`, `documentId` (null = standalone), `folderId`.
Query: `documentId`, `standalone=1`, `linked=1`, `type`.
