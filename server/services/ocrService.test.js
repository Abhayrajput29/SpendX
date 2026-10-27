import assert from 'node:assert/strict';
import test from 'node:test';
import { assessReceiptImageQuality, parseReceiptWithRegex } from './ocrService.js';
import { localCategorize } from './aiService.js';

test('receipt parsing selects the labeled merchant and receipt date, not the date of birth', () => {
  const parsed = parseReceiptWithRegex([
    'Transport Department',
    'Government of Uttar Pradesh',
    'Office Name      RTO, AYODHYA      Receipt Date 26-10-2026',
    'Date of Birth 02-07-2004',
    'Transaction Name Issue New LL',
    'Fee Amount 300.00 Additional Fee 50.00 Total 300.00',
    'TOTAL Amount: 350.00'
  ].join('\n'));

  assert.equal(parsed.merchant, 'RTO, AYODHYA');
  assert.equal(parsed.date, '2026-10-26');
  assert.equal(parsed.amount, 350);
  assert.equal(parsed.description, 'Issue New LL');
  assert.equal(localCategorize(parsed.merchant).category, 'Transport & Auto');
});

test('receipt parsing includes separate fees when no final total is printed', () => {
  const parsed = parseReceiptWithRegex('Fee Amount 300.00\nAdditional Fee 50.00');

  assert.equal(parsed.amount, 350);
});

test('image quality reports Tesseract confidence and corrects unsupported poor assessments', () => {
  const quality = assessReceiptImageQuality({
    text: 'Readable receipt text',
    confidence: 67,
    modelAssessment: { status: 'poor', issues: ['unreadable-text'] }
  });

  assert.equal(quality.status, 'good');
  assert.equal(quality.score, 67);
  assert.deepEqual(quality.issues, []);
});
