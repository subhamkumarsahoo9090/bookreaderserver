# Book Reader Server

Node.js / Express backend for **AksharaX**: extract text from many file types, store lightweight metadata in MongoDB, prefer **Google Drive** for document text when connected, plus folders, vocabulary, notes, shared admin library, and themes.

## Stack

- Express + Multer (`memoryStorage`)
- MongoDB + Mongoose (auth, settings, metadata)
- JWT auth + optional Google OAuth / Drive
- OCR: Tesseract.js (multi-language) or Google Cloud Vision
- Parsers: `pdf-parse`, `mammoth` (docx), JSZip (epub), plain text / RTF strip

## Setup

```bash
npm install
cp .env.example .env
# edit MONGODB_URI, JWT_SECRET, and optional Google / admin vars
npm run dev
```

Server: `http://localhost:5000`

### Admin bootstrap

On startup, `seedAdmin` ensures:

- `ADMIN_EMAIL` (default `subhamkumarsahoo9090@gmail.com`)
- `ADMIN_PASSWORD` (default `123456`)
- role `admin`

Also promote any emails in `ADMIN_EMAILS` on login/register.

### Google OAuth + Drive

1. Create a project in [Google Cloud Console](https://console.cloud.google.com/).
2. Enable **Google Drive API** and **Google+ / People API** (userinfo).
3. Create **OAuth 2.0 Client ID** (Web application).
4. Authorized redirect URI: `http://localhost:5000/api/auth/google/callback` (or your deployed API URL + `/api/auth/google/callback`).
5. Set in `.env`:

```
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=http://localhost:5000/api/auth/google/callback
FRONTEND_URL=http://localhost:3000
```

If these are missing, email/password auth and Mongo storage still work; Google buttons show a clear “not configured” message.

**Scopes:** `openid email profile` + `drive.file` (files created by the app only).

**Behaviour:** When Drive is connected, new folders/docs are written under Drive folder `AksharaX/`. Mongo keeps title, ids, preview, wordCount — not full `extractedText`. Legacy Mongo documents remain readable.

### OCR languages

Pass `ocrLang` on upload (`auto`, `eng`, `hin`, `ori`, `ben`, `tam`, …). Default auto uses `eng+hin+ori`. Tesseract downloads language packs on first use.

## API (selected)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/auth/register` | — | Register |
| POST | `/api/auth/login` | — | Login |
| GET | `/api/auth/google` | — | `{ url }` Google OAuth start (`?state=login\|drive`) |
| GET | `/api/auth/google/callback` | — | OAuth redirect → frontend with JWT |
| GET | `/api/auth/me` | JWT | Current user (+ settings, driveConnected) |
| PATCH | `/api/auth/settings` | JWT | theme, fonts, dyslexia, language, etc. |
| GET/DELETE | `/api/auth/drive` | JWT | Drive status / disconnect |
| GET | `/api/shared-library` | JWT | Published shared books |
| GET | `/api/shared-library/:id` | JWT | Read shared book text |
| GET/POST/PATCH/DELETE | `/api/shared-library/admin…` | JWT+admin | Manage shared catalog |
| POST | `/api/documents/process` | JWT | Upload → OCR → Drive or Mongo |

### Process document (multipart)

`file`, `folderId`, `title`, optional `fileType`, optional `ocrLang`.
