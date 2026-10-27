import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

dotenv.config();

// ---------------------------------------------------------------------------
// Model cascade — uses current stable models and tolerates retired configured IDs
// ---------------------------------------------------------------------------

const MODEL_CASCADE = [...new Set([
  process.env.GEMINI_MODEL,
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
  'gemini-3.6-flash',
].filter(Boolean))];
export const GEMINI_REQUEST_TIMEOUT_MS = 30_000;

/**
 * Extract the server-suggested retry delay (in ms) from a 429 error.
 * The error details may contain a `RetryInfo` with `retryDelay` like "4s".
 */
function extractRetryDelayMs(error, defaultMs = 5000) {
  try {
    const details = error?.errorDetails;
    if (Array.isArray(details)) {
      for (const d of details) {
        if (d?.retryDelay) {
          const seconds = parseFloat(d.retryDelay.replace('s', ''));
          if (!isNaN(seconds)) return Math.ceil(seconds * 1000) + 500; // add 500ms buffer
        }
      }
    }
    // Also try to parse from the message string: "Please retry in 4.6s"
    if (error?.message) {
      const m = error.message.match(/retry in ([\d.]+)s/i);
      if (m) return Math.ceil(parseFloat(m[1]) * 1000) + 500;
    }
  } catch {
    // ignore
  }
  return defaultMs;
}

/**
 * Call generateContent with exponential-backoff retry for 429 / 503 errors.
 * Respects the server-suggested retryDelay when available.
 *
 * @param {object} model - Gemini GenerativeModel instance
 * @param {string|object} prompt
 * @param {number} retries - max retry attempts
 * @param {number} baseDelay - initial delay in ms (overridden by retryDelay if present)
 */
export async function generateContentWithRetry(model, prompt, retries = 3, baseDelay = 2000) {
  let delay = baseDelay;
  for (let i = 0; i <= retries; i++) {
    try {
      return await model.generateContent(prompt);
    } catch (error) {
      const status = error.status || 0;
      const msg = error.message || '';
      const is429 = status === 429 || msg.includes('429') || msg.toLowerCase().includes('quota');
      const is503 = status === 503 || msg.includes('503') || msg.toLowerCase().includes('overloaded');
      const isRetryable = is429 || is503;

      if (isRetryable && i < retries) {
        const waitMs = Math.min(is429 ? extractRetryDelayMs(error, delay) : delay, 10_000);
        console.warn(
          `Gemini API: ${is429 ? 'Quota/rate-limit' : 'Overloaded'} (attempt ${i + 1}/${retries}). ` +
          `Waiting ${waitMs}ms before retry...`
        );
        await new Promise((resolve) => setTimeout(resolve, waitMs));
        delay = Math.round(delay * 2); // exponential backoff for subsequent retries
      } else {
        throw error;
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Singleton Gemini instances — one per model in the cascade
// ---------------------------------------------------------------------------

const geminiApiKey = process.env.GEMINI_API_KEY;

let _genAI = null;

// Holds { text: GenerativeModel, json: GenerativeModel } per model name
const _modelCache = {};

if (geminiApiKey) {
  try {
    _genAI = new GoogleGenerativeAI(geminiApiKey);

    // Pre-warm the primary model
    const primary = MODEL_CASCADE[0];
    _modelCache[primary] = {
      text: _genAI.getGenerativeModel({ model: primary }, { timeout: GEMINI_REQUEST_TIMEOUT_MS }),
      json: _genAI.getGenerativeModel({
        model: primary,
        generationConfig: { responseMimeType: 'application/json' },
      }, { timeout: GEMINI_REQUEST_TIMEOUT_MS }),
    };

    console.log(`Gemini Client: initialized (primary model: ${primary}, cascade: ${MODEL_CASCADE.join(' → ')}).`);
  } catch (error) {
    console.error('Gemini Client: initialization failed.', error);
  }
} else {
  console.log('Gemini Client: No GEMINI_API_KEY found — running in local fallback mode.');
}

/**
 * Lazily get (or create) a model instance from the cache.
 * @param {string} modelName
 * @param {'text'|'json'} type
 */
function getModel(modelName, type, timeoutMs = GEMINI_REQUEST_TIMEOUT_MS) {
  if (!_genAI) return null;
  if (timeoutMs !== GEMINI_REQUEST_TIMEOUT_MS) {
    const config = type === 'json' ? { generationConfig: { responseMimeType: 'application/json' } } : {};
    return _genAI.getGenerativeModel({ model: modelName, ...config }, { timeout: timeoutMs });
  }
  if (!_modelCache[modelName]) {
    _modelCache[modelName] = {
      text: _genAI.getGenerativeModel({ model: modelName }, { timeout: GEMINI_REQUEST_TIMEOUT_MS }),
      json: _genAI.getGenerativeModel({
        model: modelName,
        generationConfig: { responseMimeType: 'application/json' },
      }, { timeout: GEMINI_REQUEST_TIMEOUT_MS }),
    };
  }
  return _modelCache[modelName][type];
}

/** @returns {import("@google/generative-ai").GoogleGenerativeAI | null} */
export function getGenAI() {
  return _genAI;
}

/** @returns {import("@google/generative-ai").GenerativeModel | null} primary text model */
export function getTextModel() {
  return _genAI ? getModel(MODEL_CASCADE[0], 'text') : null;
}

/** @returns {import("@google/generative-ai").GenerativeModel | null} primary JSON model */
export function getJsonModel() {
  return _genAI ? getModel(MODEL_CASCADE[0], 'json') : null;
}

/**
 * Attempt generateContent across the full model cascade.
 * Tries the next model on quota exhaustion or when a configured model is retired.
 * On 503 (overloaded) retries the same model with backoff first.
 *
 * @param {string|object} prompt
 * @param {'text'|'json'} type - 'text' (default) or 'json'
 * @param {number} timeoutMs - per-model request timeout
 * @param {number} retries - retries for transient quota/overload responses
 * @returns {Promise<import("@google/generative-ai").GenerateContentResult>}
 */
export async function generateContentWithCascade(prompt, type = 'text', timeoutMs = GEMINI_REQUEST_TIMEOUT_MS, retries = 2) {
  if (!_genAI) throw new Error('Gemini API not initialized — no GEMINI_API_KEY set.');

  let lastError;
  for (const modelName of MODEL_CASCADE) {
    const model = getModel(modelName, type, timeoutMs);
    try {
      return await generateContentWithRetry(model, prompt, retries, 3000);
    } catch (error) {
      const status = error.status || 0;
      const msg = error.message || '';
      const isQuotaExhausted =
        status === 429 || msg.includes('429') || msg.toLowerCase().includes('quota');
      const isModelUnavailable = (status === 404 || status === 410) &&
        /model|not found|no longer available/i.test(msg);

      if ((isQuotaExhausted || isModelUnavailable) && MODEL_CASCADE.indexOf(modelName) < MODEL_CASCADE.length - 1) {
        console.warn(`Gemini: ${isModelUnavailable ? 'Model unavailable' : 'Quota exhausted'} on ${modelName}, trying next model in cascade...`);
        lastError = error;
        continue;
      }
      throw error; // non-quota error or last model in cascade
    }
  }
  throw lastError;
}
