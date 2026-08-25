const Tesseract = require('tesseract.js');
const pdfParse = require('pdf-parse');
const AppError = require('../utils/AppError');

let visionClient = null;

function getVisionClient() {
  if (visionClient) return visionClient;
  // Lazy-load so tesseract-only installs don't require credentials at boot
  const vision = require('@google-cloud/vision');
  visionClient = new vision.ImageAnnotatorClient();
  return visionClient;
}

function countWords(text) {
  const trimmed = (text || '').trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

async function ocrImageWithTesseract(buffer) {
  const { data } = await Tesseract.recognize(buffer, 'eng', {
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

/**
 * Run OCR / text extraction entirely on an in-memory buffer.
 * Original media is never written to disk or cloud storage.
 */
async function runOcrOnBuffer(fileBuffer, fileType) {
  if (!fileBuffer || !Buffer.isBuffer(fileBuffer)) {
    throw new AppError('Missing file buffer', 400);
  }

  const type = (fileType || '').toLowerCase();
  let extractedText = '';

  if (type === 'pdf') {
    extractedText = await extractFromPdf(fileBuffer);
    // Scanned PDFs may have little/no embedded text — fall back to Vision on first page if configured
    if (!extractedText && process.env.OCR_PROVIDER === 'google') {
      extractedText = await ocrImageWithGoogle(fileBuffer);
    }
  } else if (type === 'image') {
    const provider = (process.env.OCR_PROVIDER || 'tesseract').toLowerCase();
    if (provider === 'google') {
      extractedText = await ocrImageWithGoogle(fileBuffer);
    } else {
      extractedText = await ocrImageWithTesseract(fileBuffer);
    }
  } else {
    throw new AppError('fileType must be "image" or "pdf"', 400);
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
  };
}

function inferFileType(mimetype, bodyType) {
  if (bodyType === 'image' || bodyType === 'pdf') return bodyType;
  if (mimetype === 'application/pdf') return 'pdf';
  if (mimetype && mimetype.startsWith('image/')) return 'image';
  return null;
}

module.exports = {
  runOcrOnBuffer,
  inferFileType,
  countWords,
};
