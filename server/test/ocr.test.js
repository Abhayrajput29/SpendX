import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'path';
import { fileURLToPath } from 'url';
import { parseReceiptWithRegex, scanReceipt } from '../services/ocrService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const sampleReceiptJpeg = path.join(__dirname, '../uploads/1782299890328-287428938.jpeg');
const sampleReceiptAvif = path.join(__dirname, '../uploads/1789050788601-385943872.jpg');
const sampleReceipt1x1 = path.join(__dirname, '../uploads/1789051015014-49609493.png');

test('parseReceiptWithRegex correctly extracts integer amounts and DD/MM/YYYY dates', () => {
  const ocrSample = `
    BLUE DART COURIER EXPRESS
    Shipment Tracking Receipt
    Date Of Shipment: 18/6/2026
    Item Description: WIRELESS EAR BUDS
    Paid Amount: 400
    Payment Mode: ONLINE
    Thank you for choosing Blue Dart
  `;

  const parsed = parseReceiptWithRegex(ocrSample);
  assert.equal(parsed.merchant, 'BLUE DART COURIER EXPRESS');
  assert.equal(parsed.date, '2026-06-18');
  assert.equal(parsed.amount, 400);
  assert.ok(Array.isArray(parsed.items));
});

test('parseReceiptWithRegex handles currency symbols, decimals, and formatted dates', () => {
  const ocrSample = `
    STARBUCKS COFFEE #1042
    Date: 2026-04-12
    Caramel Macchiato   $ 5.75
    Blueberry Muffin    $ 3.50
    Subtotal: $ 9.25
    Tax: $ 0.74
    TOTAL DUE: $ 9.99
    Card ending in 4242
  `;

  const parsed = parseReceiptWithRegex(ocrSample);
  assert.equal(parsed.merchant, 'STARBUCKS COFFEE 1042');
  assert.equal(parsed.date, '2026-04-12');
  assert.equal(parsed.amount, 9.99);
});

test('parseReceiptWithRegex handles thousand separators and Indian Rupees format', () => {
  const ocrSample = `
    RELIANCE DIGITAL SUPERSTORE
    15-08-2025
    Invoice No: RD-9923
    Total Amount Paid: ₹ 14,999.00
    Net Banking Ref: 98124018
  `;

  const parsed = parseReceiptWithRegex(ocrSample);
  assert.equal(parsed.merchant, 'RELIANCE DIGITAL SUPERSTORE');
  assert.equal(parsed.date, '2025-08-15');
  assert.equal(parsed.amount, 14999);
});

test('parseReceiptWithRegex returns safe defaults on empty or noise text', () => {
  const parsed = parseReceiptWithRegex('');
  assert.equal(parsed.merchant, 'Receipt Store');
  assert.equal(parsed.amount, 0);
  assert.ok(typeof parsed.date === 'string' && parsed.date.length === 10);
  assert.deepEqual(parsed.items, []);
});

test('scanReceipt processes a valid JPEG receipt image without crashing', async () => {
  const result = await scanReceipt(sampleReceiptJpeg);
  assert.ok(result);
  assert.ok(result.merchant && result.merchant.length > 0);
  assert.ok(typeof result.amount === 'number');
  assert.ok(result.date && /^\d{4}-\d{2}-\d{2}$/.test(result.date));
  assert.ok(result.category);
});

test('scanReceipt safely processes AVIF / modern format image without crashing', async () => {
  const result = await scanReceipt(sampleReceiptAvif);
  assert.ok(result);
  assert.ok(result.merchant);
  assert.ok(typeof result.amount === 'number');
  assert.ok(result.category);
});

test('scanReceipt safely handles a 1x1 image without crashing', async () => {
  const result = await scanReceipt(sampleReceipt1x1);
  assert.ok(result);
  assert.ok(result.merchant);
  assert.equal(result.amount, 0);
});

test('scanReceipt gracefully handles a non-existent file path', async () => {
  const result = await scanReceipt('/non/existent/file.png');
  assert.ok(result);
  assert.equal(result.amount, 0);
  assert.ok(result.merchant);
});
