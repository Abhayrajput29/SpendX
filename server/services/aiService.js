import { generateContentWithCascade, generateContentWithRetry, getJsonModel } from '../utils/geminiClient.js';

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

// ---------------------------------------------------------------------------
// Standard expense categories (single source of truth)
// ---------------------------------------------------------------------------

export const CATEGORIES = [
  'Food & Dining',
  'Transport & Auto',
  'Utilities & Bills',
  'Shopping',
  'Entertainment',
  'Healthcare & Fitness',
  'Education',
  'Travel',
  'Miscellaneous',
];

// ---------------------------------------------------------------------------
// Local rule-based classifier (used when Gemini is unavailable)
// ---------------------------------------------------------------------------

const ruleMap = [
  {
    category: 'Food & Dining',
    keywords: [
      'mcdonald', 'burger', 'starbucks', 'pizza', 'subway', 'restaurant',
      'swiggy', 'zomato', 'cafe', 'food', 'dining', 'coffee', 'lunch',
      'dinner', 'breakfast', 'eat', 'bakery', 'kfc', 'domino', 'grill',
      'bistro', 'foodland', 'grocery', 'groceries', 'supermarket', 'sweets',
    ],
    tags: ['food', 'dining'],
  },
  {
    category: 'Transport & Auto',
    keywords: [
      'uber', 'lyft', 'taxi', 'cab', 'metro', 'train', 'bus', 'fuel',
      'petrol', 'diesel', 'gas station', 'toll', 'parking', 'ola', 'auto',
      'rickshaw', 'railway', 'irctc',
    ],
    tags: ['commute', 'transport'],
  },
  {
    category: 'Utilities & Bills',
    keywords: [
      'electricity', 'water', 'gas bill', 'internet', 'wifi', 'broadband',
      'mobile', 'recharge', 'phone bill', 'rent', 'insurance', 'power',
      'telecom', 'sewer', 'trash', 'landlord',
    ],
    tags: ['bills', 'utilities'],
  },
  {
    category: 'Shopping',
    keywords: [
      'amazon', 'flipkart', 'walmart', 'target', 'clothing', 'shoes', 'mall',
      'zara', 'h&m', 'myntra', 'store', 'buy', 'shampoo', 'soap', 'ikea',
      'decathlon', 'costco', 'boutique', 'fashion',
    ],
    tags: ['shopping', 'goods'],
  },
  {
    category: 'Entertainment',
    keywords: [
      'movie', 'cinema', 'theater', 'bookmyshow', 'concert', 'game', 'steam',
      'playstation', 'xbox', 'pub', 'bar', 'club', 'netflix', 'spotify',
      'prime video', 'disney', 'music', 'arcade', 'bowling',
    ],
    tags: ['leisure', 'entertainment'],
  },
  {
    category: 'Healthcare & Fitness',
    keywords: [
      'doctor', 'hospital', 'medicine', 'pharmacy', 'chemist', 'gym',
      'fitness', 'yoga', 'clinic', 'dentist', 'health', 'medical', 'therapy',
      'workout',
    ],
    tags: ['health', 'fitness'],
  },
  {
    category: 'Education',
    keywords: [
      'tuition', 'course', 'udemy', 'coursera', 'school', 'college', 'fees',
      'book', 'stationery', 'exam', 'class', 'workshop', 'tutorial', 'seminar',
    ],
    tags: ['education', 'learning'],
  },
  {
    category: 'Travel',
    keywords: [
      'hotel', 'airbnb', 'booking.com', 'flight', 'trip', 'vacation',
      'holiday', 'makemytrip', 'expedia', 'hostel', 'resort', 'cruise',
      'luggage',
    ],
    tags: ['travel', 'vacation'],
  },
];

/**
 * Extract a short merchant name from the raw description.
 */
function extractLocalMerchant(desc) {
  const words = desc.trim().split(/\s+/);
  if (words.length === 0) return '';
  const rawMerchant = words.slice(0, Math.min(words.length, 2)).join(' ');
  return rawMerchant.replace(/[^a-zA-Z0-9\s]/g, '').trim();
}

/**
 * Rule-based local classifier.
 * @param {string} description
 * @returns {{ category: string, tags: string[], merchant: string }}
 */
function localCategorize(description) {
  const lower = description.toLowerCase();
  for (const rule of ruleMap) {
    for (const kw of rule.keywords) {
      if (lower.includes(kw)) {
        return {
          category: rule.category,
          tags: [...rule.tags],
          merchant: extractLocalMerchant(description),
        };
      }
    }
  }
  return {
    category: 'Miscellaneous',
    tags: ['general'],
    merchant: extractLocalMerchant(description),
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Auto-categorize a transaction description via Gemini cascade or local fallback.
 * @param {string} description
 * @returns {Promise<{ category: string, tags: string[], merchant: string }>}
 */
export async function autoCategorize(description) {
  if (!description || description.trim() === '') {
    return { category: 'Miscellaneous', tags: ['general'], merchant: '' };
  }

  // 1. Fast local rule match — instant response & quota conservation
  const local = localCategorize(description);
  if (local.category !== 'Miscellaneous') {
    return local;
  }

  // 2. Try Gemini with JSON mode via cascade
  const geminiModelJson = getJsonModel();
  if (geminiModelJson) {
    try {
      const prompt = `You are a financial AI. Categorize the transaction description: "${description}" into exactly one of these categories:\n${CATEGORIES.join(', ')}.\nExtract the merchant name and suggest 1-3 tags related to the transaction.\nReturn a valid JSON object matching this schema:\n{\n  "category": "exact category string from the list above",\n  "tags": ["tag1", "tag2"],\n  "merchant": "merchant name or empty string"\n}`;

      const result = await generateContentWithRetry(geminiModelJson, prompt, 1, 2000);
      const jsonText = result.response.text().trim();
      const parsed = JSON.parse(jsonText);

      let finalCategory = parsed.category;
      if (!CATEGORIES.includes(finalCategory)) {
        finalCategory =
          CATEGORIES.find(
            (c) => c.toLowerCase() === finalCategory?.toLowerCase()
          ) || 'Miscellaneous';
      }

      return {
        category: finalCategory,
        tags: Array.isArray(parsed.tags) ? parsed.tags : ['ai'],
        merchant: parsed.merchant || extractLocalMerchant(description),
      };
    } catch (error) {
      console.warn('AI Service: Gemini categorization failed, using local fallback.', error?.status || error?.message);
      return localCategorize(description);
    }
  }

  return localCategorize(description);
}

// ---------------------------------------------------------------------------
// Local advisor fallback — rich rule-based insights when Gemini is unavailable
// ---------------------------------------------------------------------------

/**
 * Build a rich HTML insights report from transaction/budget data locally.
 * @param {{ totalSpent: number, categories: Object, txCount: number }} summary
 * @param {Object} budgetSummary  { category: limit }
 * @param {string|null} question
 * @returns {string} HTML
 */
function buildLocalInsights(summary, budgetSummary, question) {
  const sortedCats = Object.entries(summary.categories)
    .sort(([, a], [, b]) => b - a);

  const totalBudget = Object.values(budgetSummary).reduce((s, v) => s + v, 0);
  const budgetPct = totalBudget > 0
    ? Math.round((summary.totalSpent / totalBudget) * 100)
    : null;

  let html = '<h4>📊 Portfolio Insights (Local Analytics)</h4>';

  // Summary row
  html += '<ul>';
  html += `<li><strong>Total Spending:</strong> ₹${summary.totalSpent.toFixed(2)} across <strong>${summary.txCount}</strong> transactions.</li>`;

  if (budgetPct !== null) {
    const budgetStatus = budgetPct >= 100
      ? `<span>🔴 <strong>Budget exhausted</strong> — you have used ${budgetPct}% of your total limit (₹${totalBudget.toFixed(0)}).</span>`
      : budgetPct >= 80
      ? `<span>🟡 <strong>Approaching limit</strong> — ${budgetPct}% of your ₹${totalBudget.toFixed(0)} budget used.</span>`
      : `<span>🟢 On track — ${budgetPct}% of your ₹${totalBudget.toFixed(0)} budget used.</span>`;
    html += `<li>${budgetStatus}</li>`;
  }

  // Category breakdown
  if (sortedCats.length > 0) {
    html += '<li><strong>Spending Breakdown:</strong><ul>';
    for (const [cat, amt] of sortedCats) {
      const pct = Math.round((amt / (summary.totalSpent || 1)) * 100);
      const limit = budgetSummary[cat];
      let badge = '';
      if (limit) {
        const catPct = Math.round((amt / limit) * 100);
        badge = catPct >= 100
          ? ' — <span>🔴 Over budget</span>'
          : catPct >= 80
          ? ` — <span>🟡 ${catPct}% of limit</span>`
          : ` — <span>🟢 ${catPct}% of limit</span>`;
      }
      html += `<li><strong>${cat}</strong>: ₹${amt.toFixed(2)} (${pct}%)${badge}</li>`;
    }
    html += '</ul></li>';
  }

  // Actionable tips
  html += '<li><strong>Quick Tips:</strong><ul>';

  // Biggest overspending category
  const overBudget = sortedCats.filter(([cat, amt]) => budgetSummary[cat] && amt > budgetSummary[cat]);
  if (overBudget.length > 0) {
    const [topCat, topAmt] = overBudget[0];
    const excess = topAmt - budgetSummary[topCat];
    html += `<li>⚠️ Reduce <strong>${topCat}</strong> spending — you are ₹${excess.toFixed(2)} over your set limit.</li>`;
  }

  // Largest category suggestion
  if (sortedCats.length > 0) {
    const [topCat, topAmt] = sortedCats[0];
    const pct = Math.round((topAmt / (summary.totalSpent || 1)) * 100);
    if (pct > 40) {
      html += `<li>💡 <strong>${topCat}</strong> makes up ${pct}% of your total spend. Consider setting a tighter budget limit here.</li>`;
    }
  }

  // No budgets set
  if (totalBudget === 0) {
    html += '<li>📌 No budget limits set. Head to <strong>Budgets</strong> to configure monthly category limits and track overspending.</li>';
  }

  html += '<li>🔮 For AI-powered personalised advice, ask a question in the chat box below.</li>';
  html += '</ul></li>';
  html += '</ul>';

  // Handle free-text question locally
  if (question) {
    const q = question.toLowerCase();
    let answer = '';

    if (q.includes('food') || q.includes('dining') || q.includes('restaurant')) {
      const foodAmt = summary.categories['Food & Dining'] || 0;
      answer = `Your Food & Dining spend is ₹${foodAmt.toFixed(2)}.${foodAmt > 3000 ? ' Consider meal prepping or cooking at home to cut costs.' : ' Keep it up!'}`;
    } else if (q.includes('save') || q.includes('saving') || q.includes('reduce')) {
      const topCats = sortedCats.slice(0, 2).map(([c, a]) => `<strong>${c}</strong> (₹${a.toFixed(2)})`);
      answer = `Your top expense categories are ${topCats.join(' and ')}. Aim to reduce these by 10–15% each month.`;
    } else if (q.includes('budget') || q.includes('limit')) {
      answer = totalBudget > 0
        ? `Your total budget is ₹${totalBudget.toFixed(2)} and you have spent ₹${summary.totalSpent.toFixed(2)} (${budgetPct}%).`
        : 'You have not set any budget limits yet. Go to the Budgets section to set category limits.';
    } else if (q.includes('total') || q.includes('spent') || q.includes('spend')) {
      answer = `Your total spending is ₹${summary.totalSpent.toFixed(2)} across ${summary.txCount} transactions.`;
    } else {
      answer = `I can see your total spend is ₹${summary.totalSpent.toFixed(2)}. For personalised AI answers, please configure a GEMINI_API_KEY in the server environment.`;
    }

    html += `<div><p><strong>Q: ${escapeHtml(question)}</strong></p><p>${answer}</p></div>`;
  }

  return html;
}

/**
 * Generate financial advisor insights using Gemini cascade or rich local fallback.
 * @param {Array} transactions
 * @param {Array} budgets
 * @param {string|null} question - optional user question
 * @returns {Promise<string>} HTML-formatted insight
 */
export async function getFinancialAdvisorInsights(transactions, budgets, question = null) {
  const summary = transactions.reduce(
    (acc, t) => {
      acc.totalSpent += t.amount;
      acc.categories[t.category] = (acc.categories[t.category] || 0) + t.amount;
      return acc;
    },
    { totalSpent: 0, categories: {}, txCount: transactions.length }
  );

  const budgetSummary = budgets.reduce((acc, b) => {
    acc[b.category] = b.limit;
    return acc;
  }, {});

  // --- Always try Gemini first via cascade (handles quota exhaustion automatically) ---
  try {
    const dataContext = {
      totalTransactions: transactions.length,
      totalSpent: parseFloat(summary.totalSpent.toFixed(2)),
      spendingByCategory: Object.fromEntries(
        Object.entries(summary.categories).map(([k, v]) => [k, parseFloat(v.toFixed(2))])
      ),
      budgets: budgetSummary,
      currency: 'INR (₹)',
    };

    const prompt = question
      ? `You are FinanceAI, a professional financial advisor. The user asks: "${question}".\nSpending context:\n${JSON.stringify(dataContext, null, 2)}\n\nAnswer concisely and directly based on the data. Use ₹ for currency. Format as clean HTML using only: h4, p, ul, ol, li, strong, em. Do NOT use markdown or code blocks.`
      : `You are FinanceAI, a professional financial advisor. Analyze the spending data below and provide exactly 3 actionable insights.\nData:\n${JSON.stringify(dataContext, null, 2)}\n\nUse ₹ for currency. Format as clean HTML using only: h4, p, ul, ol, li, strong, em. Do NOT use markdown or code blocks. Keep each insight concise (2-3 sentences).`;

    const result = await generateContentWithCascade(prompt, 'text');
    const text = result.response.text().trim();

    // Strip accidental markdown code fences if Gemini wraps in ```html
    const cleaned = text.replace(/^```html?\n?/i, '').replace(/\n?```$/i, '').trim();
    return cleaned;

  } catch (error) {
    const isQuota = error?.status === 429 || error?.message?.toLowerCase().includes('quota');
    const isNoKey = error?.message?.includes('not initialized');
    console.warn(
      isQuota
        ? 'AI Advisor: All Gemini models quota-exhausted — serving local insights.'
        : isNoKey
        ? 'AI Advisor: No API key — serving local insights.'
        : `AI Advisor: Gemini failed (${error?.status || error?.message}) — serving local insights.`
    );
    // Always return a useful local response — never fail silently
    return buildLocalInsights(summary, budgetSummary, question);
  }
}
