import { generateContentWithRetry, getTextModel, getJsonModel } from '../utils/geminiClient.js';

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
 * Auto-categorize a transaction description via Gemini or local fallback.
 * @param {string} description
 * @returns {Promise<{ category: string, tags: string[], merchant: string }>}
 */
export async function autoCategorize(description) {
  if (!description || description.trim() === '') {
    return { category: 'Miscellaneous', tags: ['general'], merchant: '' };
  }

  const geminiModelJson = getJsonModel();

  if (geminiModelJson) {
    try {
      const prompt = `You are a financial AI. Categorize the transaction description: "${description}" into exactly one of these categories:\n${CATEGORIES.join(', ')}.\nExtract the merchant name and suggest 1-3 tags related to the transaction.\nReturn a valid JSON object matching this schema:\n{\n  "category": "exact category string from the list above",\n  "tags": ["tag1", "tag2"],\n  "merchant": "merchant name or empty string"\n}`;

      const result = await generateContentWithRetry(geminiModelJson, prompt);
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
      console.error('AI Service: Gemini categorization failed, using local fallback.', error);
      return localCategorize(description);
    }
  }

  return localCategorize(description);
}

/**
 * Generate financial advisor insights using Gemini or a local fallback.
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
    { totalSpent: 0, categories: {} }
  );

  const budgetSummary = budgets.reduce((acc, b) => {
    acc[b.category] = b.limit;
    return acc;
  }, {});

  const geminiModel = getTextModel();

  // --- Local fallback ---
  if (!geminiModel) {
    let html = '<h4>Smart Portfolio Insights (Local Engine)</h4><ul>';
    html += `<li><strong>Total Spending:</strong> You spent a total of <strong>₹${summary.totalSpent.toFixed(2)}</strong> this period.</li>`;

    let maxCat = '';
    let maxAmt = 0;
    for (const [cat, amt] of Object.entries(summary.categories)) {
      if (amt > maxAmt) {
        maxAmt = amt;
        maxCat = cat;
      }
      if (budgetSummary[cat] && amt > budgetSummary[cat]) {
        html += `<li class="alert-item"><span class="warning-text">⚠️ Budget exceeded:</span> You spent <strong>₹${amt.toFixed(2)}</strong> on <strong>${cat}</strong>, exceeding your limit of ₹${budgetSummary[cat]}.</li>`;
      }
    }
    if (maxCat) {
      html += `<li><strong>Top Category:</strong> Your highest expenditure was in <strong>${maxCat}</strong> (₹${maxAmt.toFixed(2)}), representing <strong>${(
        (maxAmt / (summary.totalSpent || 1)) *
        100
      ).toFixed(0)}%</strong> of your total budget.</li>`;
    }
    html += '<li><strong>Action Item:</strong> Set up category limits to keep tabs on incremental costs.</li>';
    html += '</ul>';

    if (question) {
      html += `<div class="chat-response"><p><strong>Q: ${question}</strong></p><p><em>Notice: Full chat support requires a GEMINI_API_KEY.</em></p></div>`;
    }
    return html;
  }

  // --- Gemini ---
  try {
    const dataContext = {
      totalTransactions: transactions.length,
      totalSpent: summary.totalSpent,
      spendingByCategory: summary.categories,
      budgets: budgetSummary,
    };

    let prompt = question
      ? `You are a professional AI Financial Advisor (FinanceAI). The user asks: "${question}".\nHere is their current spending summary for context:\n${JSON.stringify(dataContext, null, 2)}.\n\nNote: The user's transaction currency is Indian Rupees (INR). Refer to values using ₹ where appropriate.\nAnswer their question directly based on their spending, suggesting concrete actions. Use clean HTML format. Do not include markdown code block tags.`
      : `You are a professional AI Financial Advisor (FinanceAI). Analyze the user's spending data:\n${JSON.stringify(dataContext, null, 2)}.\n\nNote: Currency is Indian Rupees (INR) — use ₹.\nProvide 3 concise, highly actionable savings insights in clean HTML (h4, p, ul, li, strong). Focus on overspending, budget progress, and smart recommendations. Do not include markdown code block tags.`;

    const result = await generateContentWithRetry(geminiModel, prompt);
    return result.response.text().trim();
  } catch (error) {
    console.error('AI Service: Gemini Advisor failed.', error);
    return `<p>Failed to generate AI insights. Your total spending this month is ₹${summary.totalSpent.toFixed(2)}.</p>`;
  }
}
