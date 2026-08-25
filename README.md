# Book Reader Server

Node.js / Express backend for a reading app that OCR-processes images and PDFs **in memory**, stores only extracted text in MongoDB, and supports folders + vocabulary.

## Stack

- Express + Multer (`memoryStorage` — no disk / S3)
- MongoDB + Mongoose
- JWT auth
- OCR: Tesseract.js (default) or Google Cloud Vision
- PDF text extraction via `pdf-parse`

## Setup

```bash
npm install
cp .env.example .env
# edit MONGODB_URI and JWT_SECRET
npm run dev
```

Server listens on `http://localhost:5000` by default.

### Google Vision (optional)

Set `OCR_PROVIDER=google` and `GOOGLE_APPLICATION_CREDENTIALS` to your service-account JSON path.

## API

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/auth/register` | — | Register |
| POST | `/api/auth/login` | — | Login |
| GET | `/api/auth/me` | JWT | Current user |
| GET/POST | `/api/folders` | JWT | List / create folders |
| PATCH/DELETE | `/api/folders/:id` | JWT | Rename / delete folder |
| POST | `/api/documents/process` | JWT | Upload file → OCR → save text |
| GET | `/api/documents` | JWT | List docs (`?folderId=`) |
| GET/PATCH/DELETE | `/api/documents/:id` | JWT | Get / update title / delete |
| GET/POST | `/api/vocabulary` | JWT | List / save word |
| DELETE | `/api/vocabulary/:id` | JWT | Remove saved word |

### Process document (multipart)

`file` (image or PDF), `folderId`, `title`, optional `fileType` (`image` \| `pdf`).

---

## Next.js frontend — how to build against this backend

Backend sirf API deta hai. Next.js web app usko call karega. Original image/PDF browser se bhejo; server OCR karke sirf text return/save karega.

### 1. Project setup

```bash
npx create-next-app@latest bookreader-web
cd bookreader-web
```

`.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:5000
```

Backend pehle `npm run dev` se `http://localhost:5000` pe chalna chahiye. CORS already enabled hai.

### 2. Suggested pages / routes

| Next.js route | Purpose | Backend calls |
|---------------|---------|---------------|
| `/login`, `/register` | Auth forms | `POST /api/auth/login`, `POST /api/auth/register` |
| `/` or `/folders` | Folder list + create | `GET/POST /api/folders` |
| `/folders/[folderId]` | Docs in folder + upload | `GET /api/documents?folderId=`, `POST /api/documents/process` |
| `/documents/[id]` | Interactive reader | `GET /api/documents/:id` |
| `/vocabulary` | Saved words | `GET/POST/DELETE /api/vocabulary` |

### 3. Auth flow

1. Register/login → response mein `token` + `user` aata hai.
2. Token ko `localStorage` (ya httpOnly cookie via Next route handler) mein save karo.
3. Har protected request pe header:

```http
Authorization: Bearer <token>
Content-Type: application/json
```

4. App load pe optional: `GET /api/auth/me` se session verify.

Example client helper:

```js
const API = process.env.NEXT_PUBLIC_API_URL;

export async function api(path, { method = 'GET', body, token, formData } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body && !formData) headers['Content-Type'] = 'application/json';

  const res = await fetch(`${API}${path}`, {
    method,
    headers,
    body: formData ? formData : body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}
```

### 4. Folders flow

1. Login ke baad `GET /api/folders` → list dikhao.
2. New folder: `POST /api/folders` with `{ "name": "Chapter 1" }`.
3. Folder open → `/folders/[folderId]` pe documents load.

### 5. Upload → OCR → save (core flow)

Browser se **multipart** upload; field name **`file`** hona zaroori hai (Multer).

```js
async function uploadDocument({ file, folderId, title, token }) {
  const formData = new FormData();
  formData.append('file', file);           // File from <input type="file" />
  formData.append('folderId', folderId);
  formData.append('title', title);
  // optional: formData.append('fileType', file.type === 'application/pdf' ? 'pdf' : 'image');

  return api('/api/documents/process', {
    method: 'POST',
    token,
    formData,
  });
}
```

UI steps:

1. User folder choose kare + title likhe + image/PDF select kare.
2. Submit → loading (OCR slow ho sakta hai, especially Tesseract).
3. Success → `{ success, document }` jisme `extractedText`, `wordCount` hota hai.
4. User ko reader page `/documents/[id]` pe bhejo.

**Note:** File server pe store nahi hoti — sirf extracted text MongoDB mein rehta hai.

### 6. Reader flow (web)

1. `GET /api/documents/:id` → `extractedText` lo.
2. Text ko words mein split karo (spaces / punctuation).
3. Har word clickable span banao.
4. Tap/click pe:
   - **Speech:** browser `window.speechSynthesis` (`SpeechSynthesisUtterance`)
   - **Definition:** free dictionary API (e.g. Free Dictionary API) ya apna service
   - **Save word:** `POST /api/vocabulary`

```js
// Save difficult word
await api('/api/vocabulary', {
  method: 'POST',
  token,
  body: {
    word: 'eloquent',
    definition: '...',
    phonetic: '/ˈel.ə.kwənt/',
    exampleSentence: '...',
    documentId: currentDocId, // optional
  },
});
```

List: `GET /api/vocabulary` · Remove: `DELETE /api/vocabulary/:id`

### 7. End-to-end sequence

```
[ Next.js browser ]
      │  POST /api/auth/login  →  token
      │  POST /api/folders     →  folderId
      │  POST /api/documents/process  (FormData: file + folderId + title)
      ▼
[ Express + Multer memory ] → OCR (Tesseract/Vision) → MongoDB (text only)
      │
      ▼
[ Next.js reader ]  GET /api/documents/:id
      │  tap word → speech + dictionary popup
      └─ POST /api/vocabulary
```

### 8. Practical tips

- Upload timeout: OCR lamba chal sakta hai — Next fetch pe enough wait / loading UI rakho.
- Max file size backend: `MAX_FILE_SIZE_MB` (default 15).
- Allowed types: jpeg, png, webp, gif, tiff, pdf.
- List docs (`GET /api/documents`) response se `extractedText` strip hota hai (lightweight); full text sirf `GET /api/documents/:id` pe.
- Production: `NEXT_PUBLIC_API_URL` ko deployed API URL pe set karo; JWT secret strong rakho.
