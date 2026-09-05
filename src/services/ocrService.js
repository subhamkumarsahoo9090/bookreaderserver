const Tesseract = require('tesseract.js');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const JSZip = require('jszip');
const AppError = require('../utils/AppError');

let visionClient = null;

function getVisionClient() {
  if (visionClient) return visionClient;
  const vision = require('@google-cloud/vision');
  visionClient = new vision.ImageAnnotatorClient();
  return visionClient;
}

function countWords(text) {
  const trimmed = (text || '').trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

const OCR_LANG_MAP = {
  auto: 'eng+hin+ori',
  eng: 'eng',
  en: 'eng',
  hin: 'hin',
  hi: 'hin',
  ori: 'ori',
  or: 'ori',
  odia: 'ori',
  ben: 'ben',
  bn: 'ben',
  tam: 'tam',
  ta: 'tam',
  tel: 'tel',
  te: 'tel',
  mar: 'mar',
  mr: 'mar',
  guj: 'guj',
  gu: 'guj',
  kan: 'kan',
  kn: 'kan',
  mal: 'mal',
  ml: 'mal',
  pan: 'pan',
  pa: 'pan',
};

function normalizeOcrLang(ocrLang) {
  if (!ocrLang || typeof ocrLang !== 'string') return 'eng+hin+ori';
  const raw = ocrLang.trim().toLowerCase();
  if (OCR_LANG_MAP[raw]) return OCR_LANG_MAP[raw];
  // allow explicit tesseract packs like eng+hin+ori
  if (/^[a-z+]+$/.test(raw)) return raw;
  return 'eng+hin+ori';
}

async function ocrImageWithTesseract(buffer, ocrLang) {
  const lang = normalizeOcrLang(ocrLang);
  const { data } = await Tesseract.recognize(buffer, lang, {
    logger: () => {},
  });
  return (data && data.text ? data.text : '').trim();
}

async function ocrImageWithGoogle(buffer) {
  const client = getVisionClient();
  const [result] = await client.documentTextDetection({
    image: { content: buffer.toString('base64') },
  });
  const full = result.fullTextAnnotation;
  return (full && full.text ? full.text : '').trim();
}

async function extractFromPdf(buffer) {
  const data = await pdfParse(buffer);
  return (data.text || '').trim();
}

async function extractFromDocx(buffer) {
  const result = await mammoth.extractRawText({ buffer });
  return (result.value || '').trim();
}

function stripHtml(html) {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractFromRtf(buffer) {
  const raw = buffer.toString('utf8');
  // Lightweight RTF → text: drop control words/groups, keep readable chars
  let text = raw
    .replace(/\\'[0-9a-fA-F]{2}/g, ' ')
    .replace(/\\[a-zA-Z]+-?\d* ?/g, ' ')
    .replace(/[{}]/g, ' ')
    .replace(/\r?\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return text;
}

async function extractFromEpub(buffer) {
  const zip = await JSZip.loadAsync(buffer);
  const names = Object.keys(zip.files).filter(
    (n) =>
      !zip.files[n].dir &&
      (n.endsWith('.xhtml') ||
        n.endsWith('.html') ||
        n.endsWith('.htm') ||
        n.endsWith('.xml'))
  );
  names.sort();
  const chunks = [];
  for (const name of names) {
    if (/meta-inf|container\.xml|package\.opf/i.test(name)) continue;
    const html = await zip.files[name].async('string');
    const plain = stripHtml(html);
    if (plain) chunks.push(plain);
  }
  return chunks.join('\n\n').trim();
}

async function extractFromTxt(buffer) {
  return buffer.toString('utf8').trim();
}

/**
 * Run OCR / text extraction entirely on an in-memory buffer.
 * @param {Buffer} fileBuffer
 * @param {string} fileType
 * @param {string} [ocrLang] - eng, hin, ori, auto, or eng+hin+ori etc.
 */
async function runOcrOnBuffer(fileBuffer, fileType, ocrLang) {
  if (!fileBuffer || !Buffer.isBuffer(fileBuffer)) {
    throw new AppError('Missing file buffer', 400);
  }

  const type = (fileType || '').toLowerCase();
  const lang = normalizeOcrLang(ocrLang);
  let extractedText = '';

  if (type === 'pdf') {
    extractedText = await extractFromPdf(fileBuffer);
    if (!extractedText) {
      const provider = (process.env.OCR_PROVIDER || 'tesseract').toLowerCase();
      if (provider === 'google') {
        extractedText = await ocrImageWithGoogle(fileBuffer);
      } else {
        extractedText = await ocrImageWithTesseract(fileBuffer, lang);
      }
    }
  } else if (type === 'image') {
    const provider = (process.env.OCR_PROVIDER || 'tesseract').toLowerCase();
    if (provider === 'google') {
      extractedText = await ocrImageWithGoogle(fileBuffer);
    } else {
      extractedText = await ocrImageWithTesseract(fileBuffer, lang);
    }
  } else if (type === 'txt') {
    extractedText = await extractFromTxt(fileBuffer);
  } else if (type === 'docx') {
    extractedText = await extractFromDocx(fileBuffer);
  } else if (type === 'rtf') {
    extractedText = extractFromRtf(fileBuffer);
  } else if (type === 'epub') {
    extractedText = await extractFromEpub(fileBuffer);
  } else {
    throw new AppError(
      'fileType must be image, pdf, txt, docx, rtf, or epub',
      400
    );
  }

  if (!extractedText) {
    throw new AppError(
      'No text could be extracted from the uploaded file',
      422
    );
  }

  return {
    extractedText,
    wordCount: countWords(extractedText),
    language: lang,
  };
}

function inferFileType(mimetype, bodyType, originalName = '') {
  const allowed = ['image', 'pdf', 'txt', 'docx', 'rtf', 'epub'];
  if (bodyType && allowed.includes(String(bodyType).toLowerCase())) {
    return String(bodyType).toLowerCase();
  }

  const name = (originalName || '').toLowerCase();
  if (mimetype === 'application/pdf' || name.endsWith('.pdf')) return 'pdf';
  if (mimetype && mimetype.startsWith('image/')) return 'image';
  if (
    mimetype === 'text/plain' ||
    name.endsWith('.txt') ||
    name.endsWith('.text')
  ) {
    return 'txt';
  }
  if (
    mimetype ===
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    name.endsWith('.docx')
  ) {
    return 'docx';
  }
  if (
    mimetype === 'application/rtf' ||
    mimetype === 'text/rtf' ||
    name.endsWith('.rtf')
  ) {
    return 'rtf';
  }
  if (
    mimetype === 'application/epub+zip' ||
    mimetype === 'application/epub' ||
    name.endsWith('.epub')
  ) {
    return 'epub';
  }
  return null;
}

module.exports = {
  runOcrOnBuffer,
  inferFileType,
  countWords,
  normalizeOcrLang,
  OCR_LANG_MAP,
};
