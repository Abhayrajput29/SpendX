import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import Tesseract from 'tesseract.js';
import { generateContentWithCascade, getGenAI, getJsonModel } from '../utils/geminiClient.js';
import { CATEGORIES, localCategorize } from './aiService.js';

const RECEIPT_GEMINI_TIMEOUT_MS = 8_000;
const RECEIPT_TEXT_PARSE_TIMEOUT_MS = 4_000;
const TESSERACT_START_TIMEOUT_MS = 15_000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
const trainedDataPath = path.join(__dirname, '..');
const languageCachePath = isServerless ? os.tmpdir() : trainedDataPath;
const QUALITY_STATUSES = new Set(['good', 'fair', 'poor']);
const QUALITY_ISSUES = new Set(['blur', 'low-resolution', 'dark', 'glare', 'cropped', 'low-ocr-confidence', 'unreadable-text']);

export function assessReceiptImageQuality({ text = '', confidence = null, modelAssessment = null } = {}) {
  const modelStatus = typeof modelAssessment?.status === 'string'
    ? modelAssessment.status.toLowerCase()
    : '';
  const issues = Array.isArray(modelAssessment?.issues)
    ? [...new Set(modelAssessment.issues.filter((issue) => QUALITY_ISSUES.has(issue)))]
    : [];

  const score = Number.isFinite(confidence)
    ? Math.max(0, Math.min(100, Math.round(confidence)))
    : null;
  if (!String(text).trim()) {
    return { status: 'poor', score, issues: [...new Set([...issues, 'unreadable-text'])] };
  }

  const physicalIssues = issues.some((issue) => ['blur', 'low-resolution', 'dark', 'glare', 'cropped'].includes(issue));
  let status = QUALITY_STATUSES.has(modelStatus) ? modelStatus : 'unknown';
  if (score !== null) {
    if (score < 40) status = 'poor';
    else if (score < 65 && status !== 'poor') status = 'fair';
    else if (score >= 65 && !physicalIssues) status = 'good';
    if (score < 65) issues.push('low-ocr-confidence');
    else {
      for (const issue of ['low-ocr-confidence', 'unreadable-text']) {
        const index = issues.indexOf(issue);
        if (index >= 0) issues.splice(index, 1);
      }
    }
  }
  return { status, score, issues: [...new Set(issues)] };
}

function getReceiptQualityWarning(quality) {
  if (quality?.status === 'poor') {
    return 'This receipt image was difficult to read. Retake it flat, in focus, well lit, and without glare; check that the whole receipt is visible. You can still review or enter the fields manually.';
  }
  if (quality?.status === 'fair') {
    return 'Some receipt text may be unclear. Review the extracted details carefully; a sharper, evenly lit image may improve the scan.';
  }
  return undefined;
}

/**
 * Standard date formatting helper: converts any recognized date parts into YYYY-MM-DD
 */
function normalizeDate(year, month, day) {
  const y = parseInt(year, 10);
  const m = parseInt(month, 10);
  const d = parseInt(day, 10);
  if (isNaN(y) || isNaN(m) || isNaN(d)) return null;
  const parsed = new Date(Date.UTC(y, m - 1, d));
  if (parsed.getUTCFullYear() !== y || parsed.getUTCMonth() !== m - 1 || parsed.getUTCDate() !== d) return null;
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function parseDateValue(value) {
  const ymdMatch = value.match(/\b(20\d{2})[-/.](0?[1-9]|1[0-2])[-/.](0?[1-9]|[12]\d|3[01])\b/);
  if (ymdMatch) return normalizeDate(ymdMatch[1], ymdMatch[2], ymdMatch[3]);

  const dmyMatch = value.match(/\b(0?[1-9]|[12]\d|3[01])[-/.](0?[1-9]|1[0-2])[-/.](20\d{2})\b/);
  if (dmyMatch) return normalizeDate(dmyMatch[3], dmyMatch[2], dmyMatch[1]);

  const monthMap = {
    jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
    jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12
  };
  const namedMatch = value.match(/\b(0?[1-9]|[12]\d|3[01])?\s*([a-zA-Z]{3,9})[\s,]+(0?[1-9]|[12]\d|3[01])?,?\s*(20\d{2})\b/);
  if (!namedMatch) return null;

  const month = monthMap[namedMatch[2].toLowerCase().slice(0, 3)];
  return month ? normalizeDate(namedMatch[4], month, namedMatch[1] || namedMatch[3] || '1') : null;
}

/**
 * Safe receipt date extraction
 */
function extractReceiptDate(text) {
  if (!text) return null;

  const datePattern = /\b(?:20\d{2}[-/.](?:0?[1-9]|1[0-2])[-/.](?:0?[1-9]|[12]\d|3[01])|(?:0?[1-9]|[12]\d|3[01])[-/.](?:0?[1-9]|1[0-2])[-/.]20\d{2}|(?:0?[1-9]|[12]\d|3[01])\s+[a-zA-Z]{3,9}\s*,?\s*20\d{2}|[a-zA-Z]{3,9}\s+(?:0?[1-9]|[12]\d|3[01])\s*,?\s*20\d{2})\b/gi;
  const candidates = [];
  for (const [lineIndex, line] of text.split('\n').entries()) {
    const matches = [...line.matchAll(datePattern)];
    for (const match of matches) {
      const date = parseDateValue(match[0]);
      if (!date) continue;

      const prefix = line.slice(0, match.index).toLowerCase();
      const label = prefix.match(/(?:receipt|transaction|purchase|invoice|bill|application)\s*date|date\s*of\s*(?:transaction|purchase|issue)/g);
      let priority = 0;
      if (label) {
        const lastLabel = label[label.length - 1];
        if (lastLabel.includes('transaction') || lastLabel.includes('purchase')) priority = 5;
        else if (lastLabel.includes('receipt')) priority = 4;
        else if (lastLabel.includes('invoice') || lastLabel.includes('bill')) priority = 3;
        else priority = 2;
      }
      if (/\bdate\s+of\s+birth\b/i.test(prefix)) priority = -1;
      candidates.push({ date, priority, lineIndex, position: match.index });
    }
  }

  candidates.sort((a, b) => b.priority - a.priority || a.lineIndex - b.lineIndex || a.position - b.position);
  return candidates[0]?.date || null;
}

/**
 * Safe receipt amount extraction supporting integer, decimal, and currency symbols
 */
function extractReceiptAmount(text) {
  if (!text) return 0.0;
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const amountPattern = /\d[\d,]*(?:\.\d{1,2})?/g;
  const getAmounts = (line) => [...line.matchAll(amountPattern)]
    .map((match) => Number(match[0].replace(/,/g, '')))
    .filter((amount) => Number.isFinite(amount) && amount > 0 && amount < 1_000_000);
  const totalLines = [];
  const feeAmounts = [];
  const allAmounts = [];

  for (const line of lines) {
    const amounts = getAmounts(line);
    if (!amounts.length || /\b20\d{2}\b/.test(line)) continue;
    allAmounts.push(...amounts);

    if (/\b(?:grand\s*total|total\s*amount|net\s*(?:amount|payable)|amount\s*(?:payable|due)|total\s*(?:payable|paid|due))\b/i.test(line)) {
      totalLines.push({ priority: 3, amounts });
    } else if (/\btotal\b/i.test(line) && !/\bsubtotal\b/i.test(line)) {
      totalLines.push({ priority: 2, amounts });
    } else if (/\b(?:paid|payable|balance\s*due|charge)\b/i.test(line) && !/\b(?:fee|tax)\b/i.test(line)) {
      totalLines.push({ priority: 1, amounts });
    }

    if (/\b(?:fee|tax|surcharge|service\s*charge|convenience\s*charge)\b/i.test(line)) {
      feeAmounts.push(...amounts);
    }
  }

  if (totalLines.length) {
    const highestPriority = Math.max(...totalLines.map(({ priority }) => priority));
    const bestLine = totalLines.filter(({ priority }) => priority === highestPriority).at(-1);
    return bestLine.amounts.at(-1);
  }

  if (feeAmounts.length > 1) return feeAmounts.reduce((total, amount) => total + amount, 0);
  return allAmounts.length ? Math.max(...allAmounts) : 0.0;
}

/**
 * Safe receipt merchant extraction
 */
function extractReceiptMerchant(text) {
  if (!text) return 'Receipt Store';
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const labeledMerchant = text.match(/(?:office\s*name|merchant|vendor|seller|store\s*name)\s*[:|]?\s*(.+?)(?=\s+(?:receipt\s*date|receipt\s*(?:no|number)|date\s+of\s+birth|bank\s*\/?\s*gateway|$)|[|;]|$)/im);
  if (labeledMerchant) {
    const merchant = labeledMerchant[1].replace(/^[\s:|]+|[\s:|]+$/g, '').trim();
    if (merchant.length >= 2 && merchant.length <= 60) return merchant;
  }

  const blacklist = [
    'welcome', 'receipt', 'invoice', 'tax invoice', 'bill', 'sale', 'cashier',
    'terminal', 'store', 'customer', 'thank you', 'shipment', 'billing', 'date',
    'government', 'application', 'transaction'
  ];

  for (let i = 0; i < Math.min(lines.length, 5); i++) {
    const line = lines[i];
    const lower = line.toLowerCase();
    const clean = line.replace(/[^a-zA-Z0-9\s.&'-]/g, '').trim();
    if (clean.length >= 3 && clean.length <= 40 && !blacklist.some(b => lower.startsWith(b)) && !/^\d+$/.test(clean)) {
      return clean;
    }
  }

  if (lines.length > 0) {
    const firstClean = lines[0].replace(/[^a-zA-Z0-9\s]/g, '').trim();
    if (firstClean.length >= 2) return firstClean;
  }

  return 'Receipt Store';
}

/**
 * Regex-based receipt parser (Robust fallback)
 */
export function parseReceiptWithRegex(ocrText) {
  const merchant = extractReceiptMerchant(ocrText);
  const date = extractReceiptDate(ocrText) || new Date().toISOString().split('T')[0];
  const amount = extractReceiptAmount(ocrText);

  // Extract possible items (lines containing item description or price)
  const lines = (ocrText || '').split('\n').map(l => l.trim()).filter(Boolean);
  const items = [];
  for (const line of lines) {
    if (line.toLowerCase().includes('description') || line.toLowerCase().includes('item')) {
      const parts = line.split(/:\s*/);
      if (parts[1] && parts[1].length > 2) items.push(parts[1].trim());
    }
  }
  const descriptionLine = lines.find((line) => /\b(?:transaction\s*(?:name|description)|service\s*(?:name|description)|purpose|particulars)\b/i.test(line));
  const labeledDescription = descriptionLine?.replace(/^.*?\b(?:transaction\s*(?:name|description)|service\s*(?:name|description)|purpose|particulars)\b\s*[:|-]?\s*/i, '').trim();

  return {
    merchant,
    date,
    amount,
    category: 'Miscellaneous',
    items,
    description: items.slice(0, 2).join(', ') || (labeledDescription && labeledDescription.length > 2 ? labeledDescription : '')
  };
}

/**
 * Parse receipt text using Gemini JSON model
 */
export async function parseReceiptWithGemini(ocrText, timeoutMs = RECEIPT_TEXT_PARSE_TIMEOUT_MS) {
  if (!getGenAI() || !getJsonModel()) throw new Error('Gemini API not initialized');

  const prompt = `You are an expert receipt parser. Given the following raw OCR text extracted from a receipt, parse it into structured JSON.
OCR Text:
"""
${ocrText}
"""

Choose the category based on the merchant's actual business or the items purchased. Do not guess Food & Dining when the merchant or purpose is unclear; use Miscellaneous instead. Ride-hailing, taxi, auto-rickshaw and bike-taxi services such as Rapido, Namma Yatri, BluSmart, Ola and Uber rides are Transport & Auto.

Please extract:
1. Merchant Name
2. Transaction Date (formatted as YYYY-MM-DD)
3. Final Total Amount (as a float/number), including every fee, tax, surcharge, or service charge and preferring the final total/payable amount over a subtotal or individual fee
4. Category (strictly one of: Food & Dining, Transport & Auto, Utilities & Bills, Shopping, Entertainment, Healthcare & Fitness, Education, Travel, Miscellaneous)
5. A concise transaction description based on the actual service or purchased items
6. Individual Line Items (as an array of strings, if visible, else empty array)

Use the date explicitly labeled receipt, transaction, purchase, or invoice date. Do not use a date of birth or other unrelated date. For government forms, identify the office named in the receipt's office/merchant field rather than the department heading. Do not invent values; use an empty string when a field is not visible.

Return a valid JSON object matching this exact schema:
{
  "merchant": "merchant name or empty string",
  "date": "YYYY-MM-DD or empty string",
  "amount": 0.00,
  "category": "exact category string",
  "description": "transaction purpose or purchased items",
  "items": ["item 1", "item 2"]
}`;

  const result = await generateContentWithCascade(prompt, 'json', timeoutMs, 0);
  const response = await result.response;
  return JSON.parse(response.text().trim());
}

/**
 * Parse receipt image directly using Gemini Multimodal Vision
 */
export async function scanReceiptWithVision(filePath) {
  const genAI = getGenAI();
  if (!genAI) throw new Error('Gemini API not initialized');

  const ext = path.extname(filePath).toLowerCase();
  let mimeType = 'image/jpeg';
  if (ext === '.png') mimeType = 'image/png';
  else if (ext === '.webp') mimeType = 'image/webp';
  else if (ext === '.avif') mimeType = 'image/avif';

  const fileBuffer = fs.readFileSync(filePath);
  const base64Data = fileBuffer.toString('base64');

  const prompt = `You are an intelligent financial OCR assistant. Analyze this receipt image and extract structured transaction details.
Allowed Categories: ${CATEGORIES.join(', ')}.
Choose the category from the merchant's actual business or items, not a guess. Do not default unknown merchants to Food & Dining; use Miscellaneous when unclear. Ride-hailing, taxi, auto-rickshaw and bike-taxi services such as Rapido, Namma Yatri, BluSmart, Ola and Uber rides are Transport & Auto.
Assess image legibility separately from receipt content. Mark quality poor when most text is unreadable due to blur, low resolution, darkness, glare, or cropping; fair when only some content is hard to read; otherwise good. Never invent receipt fields when text is illegible.
Use the receipt, transaction, purchase, or invoice date, not a date of birth. Choose the merchant/office named on the receipt rather than a generic department heading. The amount must be the final total paid/payable and must include fees, taxes, and surcharges; do not return a subtotal or one fee when a final total is printed. A vehicle licensing, RTO, or motor-vehicle service is Transport & Auto.

Return valid JSON with:
{
  "merchant": "merchant / store / service name",
  "date": "YYYY-MM-DD (or empty string if not visible)",
  "amount": 0.00,
  "category": "most appropriate category from allowed list",
  "description": "short transaction purpose based on the receipt",
  "items": ["Item name 1", "Item name 2"],
  "rawSummary": "A concise 1-2 sentence transcription of key lines on the receipt",
  "imageQuality": { "status": "good, fair, or poor", "issues": [] }
}`;

  const result = await generateContentWithCascade([
    prompt,
    {
      inlineData: {
        data: base64Data,
        mimeType: mimeType
      }
    }
  ], 'json', RECEIPT_GEMINI_TIMEOUT_MS, 0);

  const response = await result.response;
  const parsed = JSON.parse(response.text().trim());

  return {
    merchant: parsed.merchant || 'Receipt Store',
    date: parsed.date || '',
    amount: typeof parsed.amount === 'number' ? parsed.amount : parseFloat(parsed.amount) || 0.0,
    category: CATEGORIES.includes(parsed.category) ? parsed.category : 'Miscellaneous',
    description: typeof parsed.description === 'string' ? parsed.description.trim() : '',
    items: Array.isArray(parsed.items) ? parsed.items : [],
    rawText: parsed.rawSummary || `${parsed.merchant} - Total: ${parsed.amount}`,
    engine: 'gemini-vision',
    qualityAssessment: parsed.imageQuality || null
  };
}

/**
 * Local OCR scanner using Tesseract.js with safe worker error handling
 */
export async function scanReceiptWithTesseract(filePath) {
  console.log('OCR Service: Running local Tesseract OCR on', filePath);

  let worker = null;
  let ocrText = '';
  let confidence = null;
  let startTimeoutId;
  let recognizeTimeoutId;

  try {
    // Create worker with error handler to prevent unhandled worker crashes
    const workerPromise = Tesseract.createWorker('eng', 1, {
      gzip: false,
      langPath: trainedDataPath,
      cachePath: languageCachePath,
      errorHandler: (err) => {
        console.warn('OCR Service: Tesseract worker internal message:', err?.message || err);
      }
    });
    try {
      worker = await Promise.race([
        workerPromise,
        new Promise((_, reject) => {
          startTimeoutId = setTimeout(() => reject(new Error('Tesseract worker initialization timed out')), TESSERACT_START_TIMEOUT_MS);
        })
      ]);
    } catch (error) {
      workerPromise.then((lateWorker) => lateWorker.terminate()).catch(() => {});
      throw error;
    } finally {
      clearTimeout(startTimeoutId);
    }

    // Run recognition with timeout guard
    const recognizePromise = worker.recognize(filePath);
    const timeoutPromise = new Promise((_, reject) => {
      recognizeTimeoutId = setTimeout(() => reject(new Error('Tesseract OCR timeout (15s exceeded)')), 15000);
    });

    const result = await Promise.race([recognizePromise, timeoutPromise]);
    ocrText = result?.data?.text || '';
    const wordConfidences = (result?.data?.words || [])
      .filter((word) => word.text?.trim() && Number.isFinite(word.confidence))
      .map((word) => word.confidence);
    confidence = wordConfidences.length
      ? wordConfidences.reduce((total, value) => total + value, 0) / wordConfidences.length
      : (Number.isFinite(result?.data?.confidence) ? result.data.confidence : null);
  } catch (error) {
    console.warn('OCR Service: Tesseract scanning encountered error:', error.message);
  } finally {
    clearTimeout(startTimeoutId);
    clearTimeout(recognizeTimeoutId);
    if (worker) {
      try {
        await worker.terminate();
      } catch {
        // Ignore termination error
      }
    }
  }

  return { text: ocrText, confidence };
}

/**
 * Primary Receipt Scanner:
 * 1. Attempts Gemini Vision (direct multimodal analysis, fast & highly accurate)
 * 2. If Gemini unavailable/fails, runs local Tesseract OCR with safe error handling
 * 3. Parses text with Gemini text parser or regex fallback
 */
export async function scanReceipt(imageInput) {
  if (!fs.existsSync(imageInput)) throw new Error('Receipt image is missing from temporary storage.');
  console.log('OCR Service: Processing temporary receipt image.');

  const ocrPromise = scanReceiptWithTesseract(imageInput);
  let visionResult = null;
  if (process.env.GEMINI_API_KEY) {
    try {
      console.log('OCR Service: Attempting Gemini Vision parsing...');
      visionResult = await scanReceiptWithVision(imageInput);
      console.log('OCR Service: Successfully parsed receipt with Gemini Vision.');
    } catch (visionError) {
      console.warn('OCR Service: Gemini Vision failed, falling back to local OCR:', visionError.message);
    }
  }

  const { text: ocrText, confidence: ocrConfidence } = await ocrPromise;
  const regexData = parseReceiptWithRegex(ocrText);
  const receiptDate = extractReceiptDate(ocrText);
  const ocrMerchant = regexData.merchant !== 'Receipt Store' ? regexData.merchant : '';
  const merchant = ocrMerchant || visionResult?.merchant || 'Receipt Store';
  const amount = regexData.amount > 0 ? regexData.amount : (visionResult?.amount || 0);
  const date = receiptDate || visionResult?.date || new Date().toISOString().split('T')[0];
  const items = visionResult?.items?.length ? visionResult.items : regexData.items;
  const description = visionResult?.description || regexData.description || '';
  const ruleCategory = localCategorize(`${merchant}\n${items.join('\n')}\n${ocrText}`).category;
  const category = ruleCategory !== 'Miscellaneous'
    ? ruleCategory
    : visionResult?.category || 'Miscellaneous';
  const quality = assessReceiptImageQuality({
    text: ocrText || visionResult?.rawText || '',
    confidence: ocrConfidence,
    modelAssessment: visionResult?.qualityAssessment
  });
  const qualityWarning = getReceiptQualityWarning(quality);

  if (visionResult) {
    return {
      ...visionResult,
      merchant,
      date,
      amount,
      category,
      description,
      items,
      rawText: ocrText || visionResult.rawText,
      engine: 'gemini-vision+tesseract',
      quality,
      ...(qualityWarning ? { warning: qualityWarning } : {})
    };
  }

  // 3. Parse extracted text with Gemini Text Model or Regex
  let parsedData = null;
  const jsonModel = getJsonModel();

  if (jsonModel && ocrText.trim().length > 10) {
    try {
      console.log('OCR Service: Parsing OCR text with Gemini JSON model...');
      parsedData = await parseReceiptWithGemini(ocrText);
      parsedData.engine = 'tesseract-gemini';
    } catch (err) {
      console.warn('OCR Service: Gemini text parsing failed, using regex fallback:', err.message);
    }
  }

  if (!parsedData) {
    console.log('OCR Service: Parsing OCR text with Regex fallback...');
    parsedData = regexData;
    parsedData.engine = 'tesseract-regex';
  }

  if (ocrMerchant) parsedData.merchant = ocrMerchant;
  if (receiptDate) parsedData.date = receiptDate;
  if (regexData.amount > 0) parsedData.amount = regexData.amount;
  if (regexData.description) parsedData.description = regexData.description;
  parsedData.category = CATEGORIES.includes(parsedData.category) ? parsedData.category : 'Miscellaneous';
  if (ruleCategory !== 'Miscellaneous') parsedData.category = ruleCategory;

  return {
    merchant: parsedData.merchant || 'Receipt Store',
    date: parsedData.date || new Date().toISOString().split('T')[0],
    amount: typeof parsedData.amount === 'number' ? parsedData.amount : parseFloat(parsedData.amount) || 0.0,
    category: parsedData.category || 'Miscellaneous',
    items: parsedData.items || [],
    description: parsedData.description || '',
    rawText: ocrText || 'Receipt processed',
    engine: parsedData.engine || 'fallback',
    quality,
    ...(qualityWarning ? { warning: qualityWarning } : {})
  };
}
