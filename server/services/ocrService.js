import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import Tesseract from 'tesseract.js';
import { getGenAI, getJsonModel } from '../utils/geminiClient.js';
import { autoCategorize, CATEGORIES } from './aiService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
const trainedDataPath = isServerless ? os.tmpdir() : path.join(__dirname, '..');

/**
 * Standard date formatting helper: converts any recognized date parts into YYYY-MM-DD
 */
function normalizeDate(year, month, day) {
  const y = parseInt(year, 10);
  const m = parseInt(month, 10);
  const d = parseInt(day, 10);
  if (isNaN(y) || isNaN(m) || isNaN(d)) return null;
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/**
 * Safe receipt date extraction
 */
function extractReceiptDate(text) {
  if (!text) return new Date().toISOString().split('T')[0];

  // 1. YYYY-MM-DD or YYYY/MM/DD
  const ymdMatch = text.match(/\b(20\d{2})[-/.](0?[1-9]|1[0-2])[-/.](0?[1-9]|[12]\d|3[01])\b/);
  if (ymdMatch) {
    const d = normalizeDate(ymdMatch[1], ymdMatch[2], ymdMatch[3]);
    if (d) return d;
  }

  // 2. DD/MM/YYYY or DD-MM-YYYY
  const dmyMatch = text.match(/\b(0?[1-9]|[12]\d|3[01])[-/.](0?[1-9]|1[0-2])[-/.](20\d{2})\b/);
  if (dmyMatch) {
    const d = normalizeDate(dmyMatch[3], dmyMatch[2], dmyMatch[1]);
    if (d) return d;
  }

  // 3. Named month: e.g. "18 Jun 2026", "June 18, 2026"
  const monthMap = {
    jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
    jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12
  };
  const namedMatch = text.match(/\b(0?[1-9]|[12]\d|3[01])?\s*([a-zA-Z]{3,9})[\s,]+(0?[1-9]|[12]\d|3[01])?,?\s*(20\d{2})\b/);
  if (namedMatch) {
    const rawMonth = namedMatch[2].toLowerCase().slice(0, 3);
    const monthNum = monthMap[rawMonth];
    const day = namedMatch[1] || namedMatch[3] || '1';
    const year = namedMatch[4];
    if (monthNum && year) {
      const d = normalizeDate(year, monthNum, day);
      if (d) return d;
    }
  }

  return new Date().toISOString().split('T')[0];
}

/**
 * Safe receipt amount extraction supporting integer, decimal, and currency symbols
 */
function extractReceiptAmount(text) {
  if (!text) return 0.0;
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  // High confidence: line with total/amount/paid keywords
  const totalKeywords = ['total', 'amount', 'paid', 'due', 'grand total', 'subtotal', 'balance', 'charge'];
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i];
    const lineLower = line.toLowerCase();
    const hasKeyword = totalKeywords.some(kw => lineLower.includes(kw));
    if (hasKeyword) {
      // Find all currency/number matches in line
      const match = line.match(/(?:[$€£₹Rs.]*|\b)\s*(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)\b/g);
      if (match) {
        for (let j = match.length - 1; j >= 0; j--) {
          const cleanNum = parseFloat(match[j].replace(/[^0-9.]/g, ''));
          if (!isNaN(cleanNum) && cleanNum > 0 && cleanNum < 1000000) {
            return cleanNum;
          }
        }
      }
    }
  }

  // Fallback: search all positive numbers in the document, pick realistic max
  const allNumbersRegex = /\b\d{1,3}(?:,\d{3})*(?:\.\d{2})?\b|\b\d+(?:\.\d{2})?\b/g;
  const matches = text.match(allNumbersRegex) || [];
  const numbers = matches
    .map(m => parseFloat(m.replace(/,/g, '')))
    .filter(n => !isNaN(n) && n > 0 && n < 1000000 && !/\b(20\d{2})\b/.test(String(n))); // skip years

  return numbers.length > 0 ? Math.max(...numbers) : 0.0;
}

/**
 * Safe receipt merchant extraction
 */
function extractReceiptMerchant(text) {
  if (!text) return 'Receipt Store';
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const blacklist = [
    'welcome', 'receipt', 'invoice', 'tax invoice', 'bill', 'sale', 'cashier',
    'terminal', 'store', 'customer', 'thank you', 'shipment', 'billing', 'date'
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
  const date = extractReceiptDate(ocrText);
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

  return {
    merchant,
    date,
    amount,
    category: 'Miscellaneous',
    items
  };
}

/**
 * Parse receipt text using Gemini JSON model
 */
export async function parseReceiptWithGemini(ocrText) {
  const geminiModel = getJsonModel();
  if (!geminiModel) throw new Error('Gemini API not initialized');

  const prompt = `You are an expert receipt parser. Given the following raw OCR text extracted from a receipt, parse it into structured JSON.
OCR Text:
"""
${ocrText}
"""

Please extract:
1. Merchant Name
2. Transaction Date (formatted as YYYY-MM-DD)
3. Total Amount (as a float/number)
4. Category (strictly one of: Food & Dining, Transport & Auto, Utilities & Bills, Shopping, Entertainment, Healthcare & Fitness, Education, Travel, Miscellaneous)
5. Individual Line Items (as an array of strings, if visible, else empty array)

Return a valid JSON object matching this exact schema:
{
  "merchant": "merchant name or empty string",
  "date": "YYYY-MM-DD",
  "amount": 0.00,
  "category": "exact category string",
  "items": ["item 1", "item 2"]
}`;

  const result = await geminiModel.generateContent(prompt);
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

  const modelName = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  const visionModel = genAI.getGenerativeModel({
    model: modelName,
    generationConfig: { responseMimeType: 'application/json' }
  });

  const prompt = `You are an intelligent financial OCR assistant. Analyze this receipt image and extract structured transaction details.
Allowed Categories: ${CATEGORIES.join(', ')}.

Return valid JSON with:
{
  "merchant": "merchant / store / service name",
  "date": "YYYY-MM-DD (or current date if not visible)",
  "amount": 0.00,
  "category": "most appropriate category from allowed list",
  "items": ["Item name 1", "Item name 2"],
  "rawSummary": "A concise 1-2 sentence transcription of key lines on the receipt"
}`;

  const result = await visionModel.generateContent([
    prompt,
    {
      inlineData: {
        data: base64Data,
        mimeType: mimeType
      }
    }
  ]);

  const response = await result.response;
  const parsed = JSON.parse(response.text().trim());

  return {
    merchant: parsed.merchant || 'Receipt Store',
    date: parsed.date || new Date().toISOString().split('T')[0],
    amount: typeof parsed.amount === 'number' ? parsed.amount : parseFloat(parsed.amount) || 0.0,
    category: CATEGORIES.includes(parsed.category) ? parsed.category : 'Miscellaneous',
    items: Array.isArray(parsed.items) ? parsed.items : [],
    rawText: parsed.rawSummary || `${parsed.merchant} - Total: ${parsed.amount}`,
    engine: 'gemini-vision'
  };
}

/**
 * Local OCR scanner using Tesseract.js with safe worker error handling
 */
export async function scanReceiptWithTesseract(filePath) {
  console.log('OCR Service: Running local Tesseract OCR on', filePath);

  let worker = null;
  let ocrText = '';

  try {
    // Create worker with error handler to prevent unhandled worker crashes
    worker = await Tesseract.createWorker('eng', 1, {
      gzip: false,
      langPath: trainedDataPath,
      errorHandler: (err) => {
        console.warn('OCR Service: Tesseract worker internal message:', err?.message || err);
      }
    });

    // Run recognition with timeout guard
    const recognizePromise = worker.recognize(filePath);
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Tesseract OCR timeout (15s exceeded)')), 15000)
    );

    const result = await Promise.race([recognizePromise, timeoutPromise]);
    ocrText = result?.data?.text || '';
  } catch (error) {
    console.warn('OCR Service: Tesseract scanning encountered error:', error.message);
  } finally {
    if (worker) {
      try {
        await worker.terminate();
      } catch (e) {
        // Ignore termination error
      }
    }
  }

  return ocrText;
}

/**
 * Primary Receipt Scanner:
 * 1. Attempts Gemini Vision (direct multimodal analysis, fast & highly accurate)
 * 2. If Gemini unavailable/fails, runs local Tesseract OCR with safe error handling
 * 3. Parses text with Gemini text parser or regex fallback
 */
export async function scanReceipt(imageInput) {
  console.log(`OCR Service: Processing receipt image: ${imageInput}`);

  // 1. Try Gemini Multimodal Vision first if API key is present
  if (process.env.GEMINI_API_KEY && fs.existsSync(imageInput)) {
    try {
      console.log('OCR Service: Attempting Gemini Vision parsing...');
      const visionResult = await scanReceiptWithVision(imageInput);
      console.log('OCR Service: Successfully parsed receipt with Gemini Vision.');

      if (!visionResult.category || visionResult.category === 'Miscellaneous') {
        const cat = await autoCategorize(visionResult.merchant);
        visionResult.category = cat.category;
      }

      return visionResult;
    } catch (visionError) {
      console.warn('OCR Service: Gemini Vision failed, falling back to local OCR:', visionError.message);
    }
  }

  // 2. Fallback to local Tesseract OCR
  let ocrText = '';
  if (fs.existsSync(imageInput)) {
    ocrText = await scanReceiptWithTesseract(imageInput);
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
    parsedData = parseReceiptWithRegex(ocrText);
    parsedData.engine = 'tesseract-regex';
  }

  if (!parsedData.category || parsedData.category === 'Miscellaneous') {
    try {
      const categorization = await autoCategorize(parsedData.merchant || ocrText.slice(0, 100));
      parsedData.category = categorization.category;
    } catch (e) {
      parsedData.category = 'Miscellaneous';
    }
  }

  return {
    merchant: parsedData.merchant || 'Receipt Store',
    date: parsedData.date || new Date().toISOString().split('T')[0],
    amount: typeof parsedData.amount === 'number' ? parsedData.amount : parseFloat(parsedData.amount) || 0.0,
    category: parsedData.category || 'Miscellaneous',
    items: parsedData.items || [],
    rawText: ocrText || 'Receipt processed',
    engine: parsedData.engine || 'fallback'
  };
}
