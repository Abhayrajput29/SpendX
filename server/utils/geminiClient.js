import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Shared helper: call generateContent with exponential-backoff retry
 * for 429 (rate-limit) and 503 (overload) errors.
 * @param {object} model - Gemini GenerativeModel instance
 * @param {string} prompt
 * @param {number} retries
 * @param {number} delay - initial delay in ms
 */
export async function generateContentWithRetry(model, prompt, retries = 2, delay = 1000) {
  for (let i = 0; i <= retries; i++) {
    try {
      return await model.generateContent(prompt);
    } catch (error) {
      const isRetryable =
        error.status === 503 ||
        error.status === 429 ||
        (error.message &&
          (error.message.includes('503') || error.message.includes('429')));

      if (isRetryable && i < retries) {
        console.warn(
          `Gemini API: Request failed with ${error.status || 'rate-limit'}. ` +
            `Retrying in ${delay}ms... (Attempt ${i + 1}/${retries})`
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
        delay = Math.round(delay * 1.5); // exponential back-off
      } else {
        throw error;
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Singleton Gemini instances — shared across all services
// ---------------------------------------------------------------------------

const geminiApiKey = process.env.GEMINI_API_KEY;

let _genAI = null;
let _textModel = null;      // plain text responses
let _jsonModel = null;      // JSON-mode responses

if (geminiApiKey) {
  try {
    _genAI = new GoogleGenerativeAI(geminiApiKey);

    _textModel = _genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });

    _jsonModel = _genAI.getGenerativeModel({
      model: 'gemini-2.5-flash-lite',
      generationConfig: { responseMimeType: 'application/json' },
    });

    console.log('Gemini Client: initialized successfully (shared singleton).');
  } catch (error) {
    console.error('Gemini Client: initialization failed.', error);
  }
} else {
  console.log('Gemini Client: No GEMINI_API_KEY found — running in local fallback mode.');
}

/** @returns {import("@google/generative-ai").GenerativeModel | null} text model */
export function getTextModel() {
  return _textModel;
}

/** @returns {import("@google/generative-ai").GenerativeModel | null} JSON model */
export function getJsonModel() {
  return _jsonModel;
}
