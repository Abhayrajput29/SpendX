import Tesseract from 'tesseract.js';
import { getJsonModel } from '../utils/geminiClient.js';
import { autoCategorize } from './aiService.js';

/**
 * Clean receipt text using Gemini API
 */
async function parseReceiptWithGemini(ocrText) {
  const geminiModel = getJsonModel();
  if (!geminiModel) throw new Error('Gemini API not initialized');

  const prompt = `You are a receipt parser. Given the following raw OCR text extracted from a receipt, parse it into structured JSON.
OCR Text:
"""
${ocrText}
"""

Please extract:
1. Merchant Name
2. Transaction Date (formatted as YYYY-MM-DD)
3. Total Amount (as a float/number)
4. Category (choose from: Food & Dining, Transport & Auto, Utilities & Bills, Shopping, Entertainment, Healthcare & Fitness, Education, Travel, Miscellaneous)
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
 * Regex-based receipt parser (Fallback)
 */
function parseReceiptWithRegex(ocrText) {
  const lines = ocrText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  
  // 1. Extract Merchant: look at first 3 non-empty lines, find one that looks like a name
  let merchant = '';
  const merchantBlacklist = ['welcome', 'receipt', 'invoice', 'tax invoice', 'bill', 'sale', 'cashier', 'terminal', 'store', 'customer'];
  for (let i = 0; i < Math.min(lines.length, 4); i++) {
    const line = lines[i];
    const isCleanName = /^[a-zA-Z0-9\s.&'-]+$/.test(line) && 
                        line.length > 2 && 
                        !merchantBlacklist.some(word => line.toLowerCase().includes(word)) &&
                        !/\d{3,}/.test(line); // No phone numbers or large codes
    if (isCleanName) {
      merchant = line;
      break;
    }
  }
  if (!merchant && lines.length > 0) {
    merchant = lines[0].replace(/[^a-zA-Z0-9\s]/g, '').trim();
  }

  // 2. Extract Date: find DD/MM/YYYY, MM/DD/YYYY, YYYY-MM-DD, or DD-MM-YYYY
  let date = null;
  const dateRegexes = [
    /\b(\d{4})[-/](\d{2})[-/](\d{2})\b/, // YYYY-MM-DD
    /\b(\d{2})[-/](\d{2})[-/](\d{4})\b/, // DD/MM/YYYY or MM/DD/YYYY
    /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* \d{1,2},? \d{4}\b/i // Jan 15, 2026
  ];

  for (const regex of dateRegexes) {
    const match = ocrText.match(regex);
    if (match) {
      const rawDate = match[0];
      // Try parsing
      const parsed = Date.parse(rawDate);
      if (!isNaN(parsed)) {
        date = new Date(parsed).toISOString().split('T')[0];
        break;
      }
    }
  }
  if (!date) {
    date = new Date().toISOString().split('T')[0]; // Default to today
  }

  // 3. Extract Amount: search for numbers with decimals. Look for keywords like "total", "amount", "sum"
  let amount = 0.0;
  let possibleAmounts = [];
  const amountRegex = /\b\d+\.\d{2}\b/g;
  let match;
  while ((match = amountRegex.exec(ocrText)) !== null) {
    possibleAmounts.push(parseFloat(match[0]));
  }

  // Look for lines containing "total", "due", "visa", "paid"
  let foundTotal = false;
  for (let i = lines.length - 1; i >= 0; i--) {
    const lineLower = lines[i].toLowerCase();
    if (lineLower.includes('total') || lineLower.includes('amount') || lineLower.includes('due') || lineLower.includes('paid')) {
      const lineMatch = lineLower.match(/\b\d+\.\d{2}\b/);
      if (lineMatch) {
        amount = parseFloat(lineMatch[0]);
        foundTotal = true;
        break;
      }
    }
  }

  // If no "total" keyword match, pick the maximum amount found (excluding very large anomalies)
  if (!foundTotal && possibleAmounts.length > 0) {
    // Receipts usually have total as the highest value (except subtotal or grand totals which are similar)
    amount = Math.max(...possibleAmounts);
  }

  return {
    merchant: merchant || 'Unknown Merchant',
    date: date,
    amount: amount,
    category: 'Miscellaneous', // Will be auto-categorized later
    items: []
  };
}

/**
 * Scan receipt image using Tesseract.js and parse contents
 * @param {string|Buffer} imageInput - Path to image file or Buffer
 * @returns {Promise<object>} Parsed receipt data
 */
export async function scanReceipt(imageInput) {
  console.log('OCR Service: Starting Tesseract OCR scanning...');
  
  let ocrText = '';
  try {
    const result = await Tesseract.recognize(imageInput, 'eng');
    ocrText = result.data.text;
  } catch (error) {
    console.error('OCR Service: Tesseract OCR failed.', error);
    throw new Error('Failed to extract text from receipt image.');
  }

  console.log('OCR Service: OCR completed. Parsing text...');
  
  let parsedData;
  const geminiModel = getJsonModel();
  if (geminiModel) {
    try {
      parsedData = await parseReceiptWithGemini(ocrText);
      console.log('OCR Service: Successfully parsed receipt with Gemini AI.');
    } catch (error) {
      console.warn('OCR Service: Gemini receipt parsing failed. Using regex fallback.', error);
      parsedData = parseReceiptWithRegex(ocrText);
    }
  } else {
    parsedData = parseReceiptWithRegex(ocrText);
    console.log('OCR Service: Parsed receipt with Local Regex.');
  }

  // If category is not set, or is default, run auto-categorization based on merchant/receipt info
  if (!parsedData.category || parsedData.category === 'Miscellaneous') {
    const categorization = await autoCategorize(parsedData.merchant || ocrText.slice(0, 100));
    parsedData.category = categorization.category;
  }

  // Return standard structure
  return {
    ...parsedData,
    rawText: ocrText
  };
}
