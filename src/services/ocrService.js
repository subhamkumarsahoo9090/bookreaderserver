const Tesseract = require('tesseract.js');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const JSZip = require('jszip');
const AppError = require('../utils/AppError');

let visionClient = null;
let sharp = null;
try {
  sharp = require('sharp');
} catch {
  sharp = null;
}

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

const INDIC_LANGS = new Set([
  'hin',
  'ori',
  'ben',
  'tam',
  'tel',
  'mar',
  'guj',
  'kan',
  'mal',
  'pan',
]);

function normalizeOcrLang(ocrLang) {
  if (!ocrLang || typeof ocrLang !== 'string') return 'eng+hin+ori';
  const raw = ocrLang.trim().toLowerCase();
  if (OCR_LANG_MAP[raw]) return OCR_LANG_MAP[raw];
  if (/^[a-z+]+$/.test(raw)) return raw;
  return 'eng+hin+ori';
}

function isIndicLang(lang) {
  return String(lang || '')
    .split('+')
    .some((p) => INDIC_LANGS.has(p));
}

/**
 * Upscale / contrast-boost scans so Odia/Hindi glyphs are large enough for Tesseract.
 */
async function preprocessImageForOcr(buffer) {
  if (!sharp) return buffer;
  try {
    const img = sharp(buffer, { failOn: 'none' });
    const meta = await img.metadata();
    const width = meta.width || 0;
    const height = meta.height || 0;
    // Indic scripts need higher resolution; upscale short edges under ~1600px
    const minSide = Math.min(width || 0, height || 0);
    const scale = minSide > 0 && minSide < 1600 ? Math.min(3, 1600 / minSide) : 1;

    let pipeline = sharp(buffer, { failOn: 'none' }).rotate(); // honor EXIF
    if (scale > 1.05) {
      pipeline = pipeline.resize({
        width: Math.round(width * scale),
        height: Math.round(height * scale),
        fit: 'fill',
        kernel: sharp.kernel.lanczos3,
      });
    }

    return pipeline
      .grayscale()
      .normalize()
      .sharpen({ sigma: 1 })
      .png()
      .toBuffer();
  } catch (err) {
    console.warn('OCR preprocess skipped:', err.message);
    return buffer;
  }
}

function scoreOcrText(text) {
  const t = String(text || '').trim();
  if (!t) return 0;
  const lines = t.split(/\n+/).filter((l) => l.trim().length > 0).length;
  // Prefer more characters and more lines (fixes “only last line” cases)
  return t.length * 2 + lines * 40;
}

/**
 * Multi-line Indic pages often fail on default PSM.
 * Try several page-seg modes and keep the richest result.
 */
async function ocrImageWithTesseract(buffer, ocrLang) {
  const lang = normalizeOcrLang(ocrLang);
  const prepared = await preprocessImageForOcr(buffer);

  // For a dedicated Indic language, don't mix eng (it confuses line detection)
  const primary = lang.includes('+')
    ? lang
    : lang;

  // PSM: 6 = uniform block, 4 = single column, 3 = auto, 11 = sparse
  const modes = isIndicLang(lang)
    ? [
        Tesseract.PSM.SINGLE_BLOCK, // 6
        Tesseract.PSM.SINGLE_COLUMN, // 4
        Tesseract.PSM.AUTO, // 3
        Tesseract.PSM.SPARSE_TEXT, // 11
      ]
    : [Tesseract.PSM.AUTO, Tesseract.PSM.SINGLE_BLOCK];

  let best = '';
  let bestScore = -1;
  let worker;

  try {
    worker = await Tesseract.createWorker(primary, 1, {
      logger: () => {},
    });

    await worker.setParameters({
      preserve_interword_spaces: '1',
      user_defined_dpi: '300',
    });

    for (const psm of modes) {
      try {
        await worker.setParameters({
          tessedit_pageseg_mode: String(psm),
          preserve_interword_spaces: '1',
        });
        const {
          data: { text },
        } = await worker.recognize(prepared);
        const cleaned = String(text || '')
          .replace(/\u000c/g, '') // form feed
          .replace(/[ \t]+\n/g, '\n')
          .replace(/\n{3,}/g, '\n\n')
          .trim();
        const score = scoreOcrText(cleaned);
        if (score > bestScore) {
          bestScore = score;
          best = cleaned;
        }
        // Good enough: multiple lines and decent length
        if (
          cleaned.split(/\n+/).filter((l) => l.trim()).length >= 3 &&
          cleaned.length > 40
        ) {
          break;
        }
      } catch (err) {
        console.warn('OCR PSM pass failed:', psm, err.message);
      }
    }

    // Auto mode: if mixed pack returned almost nothing, retry Oriya-only / Hindi-only
    if (lang.includes('+') && scoreOcrText(best) < 60) {
      for (const fallback of ['ori', 'hin', 'eng']) {
        try {
          await worker.reinitialize(fallback);
          await worker.setParameters({
            tessedit_pageseg_mode: String(Tesseract.PSM.SINGLE_BLOCK),
            preserve_interword_spaces: '1',
          });
          const {
            data: { text },
          } = await worker.recognize(prepared);
          const cleaned = String(text || '').trim();
          const score = scoreOcrText(cleaned);
          if (score > bestScore) {
            bestScore = score;
            best = cleaned;
          }
        } catch (err) {
          console.warn('OCR fallback lang failed:', fallback, err.message);
        }
      }
    }
  } finally {
    if (worker) {
      try {
        await worker.terminate();
      } catch {
        /* ignore */
      }
    }
  }

  return best;
}

async function ocrImageWithGoogle(buffer) {
  const client = getVisionClient();
  const prepared = await preprocessImageForOcr(buffer);
  const [result] = await client.documentTextDetection({
    image: { content: prepared.toString('base64') },
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
