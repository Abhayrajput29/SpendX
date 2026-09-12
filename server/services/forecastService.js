import { generateContentWithRetry, getTextModel } from '../utils/geminiClient.js';
import { CATEGORIES } from './aiService.js';

// ---------------------------------------------------------------------------
// Math helpers
// ---------------------------------------------------------------------------

/**
 * Ordinary Least Squares linear regression.
 * @param {{ x: number, y: number }[]} points
 * @returns {{ slope: number, intercept: number, predict: (x: number) => number }}
 */
function linearRegression(points) {
  const n = points.length;
  if (n === 0) return { slope: 0, intercept: 0, predict: () => 0 };

  let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
  for (const { x, y } of points) {
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumXX += x * x;
  }

  const denominator = n * sumXX - sumX * sumX;
  const slope = denominator === 0 ? 0 : (n * sumXY - sumX * sumY) / denominator;
  const intercept = (sumY - slope * sumX) / n;

  return { slope, intercept, predict: (x) => slope * x + intercept };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate a spending forecast using OLS regression and Gemini narrative.
 * @param {Array} transactions
 * @param {Array} budgets
 * @returns {Promise<object>} Forecast bundle
 */
export async function generateForecast(transactions = [], budgets = []) {
  const now = new Date();

  // Build last-12-months structure
  const monthsList = [];
  const monthlyTotals = {};
  const monthlyCategoryTotals = {};

  for (let m = 11; m >= 0; m--) {
    const target = new Date(now.getFullYear(), now.getMonth() - m, 15);
    const monthStr = `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, '0')}`;
    monthsList.push(monthStr);
    monthlyTotals[monthStr] = 0;
    monthlyCategoryTotals[monthStr] = {};
    CATEGORIES.forEach((cat) => {
      monthlyCategoryTotals[monthStr][cat] = 0;
    });
  }

  // Populate with actual transaction data
  transactions.forEach((t) => {
    const d = new Date(t.date);
    const monthStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (monthlyTotals[monthStr] !== undefined) {
      monthlyTotals[monthStr] += t.amount;
      if (monthlyCategoryTotals[monthStr][t.category] !== undefined) {
        monthlyCategoryTotals[monthStr][t.category] += t.amount;
      } else {
        monthlyCategoryTotals[monthStr][t.category] =
          (monthlyCategoryTotals[monthStr][t.category] || 0) + t.amount;
      }
    }
  });

  // Overall OLS regression
  const regressionPoints = monthsList.map((monthStr, idx) => ({
    x: idx,
    y: monthlyTotals[monthStr],
  }));
  const reg = linearRegression(regressionPoints);

  // Historical average (for clamping projections)
  const historicalAvg =
    regressionPoints.reduce((sum, p) => sum + p.y, 0) / (regressionPoints.length || 1);

  // Project next 3 months
  const projectedMonths = [];
  for (let step = 1; step <= 3; step++) {
    const target = new Date(now.getFullYear(), now.getMonth() + step, 15);
    const monthStr = `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, '0')}`;
    const xVal = 11 + step;
    let projectedAmt = reg.predict(xVal);
    if (projectedAmt < historicalAvg * 0.2) projectedAmt = historicalAvg * 0.2;

    const recommendedBudget = Math.round((projectedAmt * 1.1) / 500) * 500;
    projectedMonths.push({
      month: monthStr,
      label: target.toLocaleString('default', { month: 'short', year: '2-digit' }),
      projectedSpent: Math.round(projectedAmt),
      recommendedBudget: Math.round(recommendedBudget),
    });
  }

  // Category-wise projections (weighted moving average of last 3 months)
  const last3Months = monthsList.slice(-3);
  const categoryRecommendations = CATEGORIES.map((cat) => {
    const v1 = monthlyCategoryTotals[last3Months[2]]?.[cat] || 0;
    const v2 = monthlyCategoryTotals[last3Months[1]]?.[cat] || 0;
    const v3 = monthlyCategoryTotals[last3Months[0]]?.[cat] || 0;

    const projectedCategorySpent = v1 * 0.5 + v2 * 0.3 + v3 * 0.2;
    let recommendedCategoryLimit = Math.round((projectedCategorySpent * 1.1) / 100) * 100;
    if (projectedCategorySpent > 0 && recommendedCategoryLimit < 500) {
      recommendedCategoryLimit = 500;
    }

    const latestMonthStr = monthsList[11];
    const currentBudgetEntry = budgets.find(
      (b) => b.category === cat && b.month === latestMonthStr
    );
    const currentLimit = currentBudgetEntry ? currentBudgetEntry.limit : 0;

    return {
      category: cat,
      historicalAvgSpent: Math.round((v1 + v2 + v3) / 3),
      projectedSpent: Math.round(projectedCategorySpent),
      recommendedLimit: Math.round(recommendedCategoryLimit),
      currentLimit,
    };
  }).sort((a, b) => b.projectedSpent - a.projectedSpent);

  // Build AI narrative
  const trendDirection =
    reg.slope > 100 ? 'upward' : reg.slope < -100 ? 'downward' : 'stable';
  const highestProjectedCategory = categoryRecommendations[0];

  let aiInsights = '';
  const geminiModel = getTextModel();

  if (geminiModel) {
    try {
      const prompt = `
You are a Predictive Financial Advisor for an AI-powered Expense Tracker.
Here is the historical monthly outflow trends and predictions for the user in Indian Rupees (₹).

Historical Data (last 12 months totals):
${monthsList.map((m) => `${m}: ₹${Math.round(monthlyTotals[m])}`).join(', ')}

Ordinary Least Squares Regression Trend:
- Monthly Growth/Decline Rate: ₹${Math.round(reg.slope)} per month
- Trajectory: ${trendDirection}

Forecasted totals for next 3 months:
${projectedMonths.map((p) => `${p.label}: Projected Outflow = ₹${p.projectedSpent}, Recommended Budget = ₹${p.recommendedBudget}`).join('\n')}

Category-Specific Outflow predictions (next month):
${categoryRecommendations.map((c) => `- ${c.category}: Projected Spent = ₹${c.projectedSpent}, Rec Budget = ₹${c.recommendedLimit}, Current Budget = ₹${c.currentLimit}`).join('\n')}

Write a concise, premium financial forecast analysis report in HTML format. Do NOT wrap it in a code block. Output just clean HTML.
Make sure to:
1. Summarize overall spending direction (rising at ₹${Math.round(reg.slope)}/month, stable, or declining).
2. Identify the highest spending risk category: ${highestProjectedCategory?.category ?? 'None'} (Projected: ₹${highestProjectedCategory?.projectedSpent ?? 0}).
3. Highlight if projected spend exceeds current budget limits for any category.
4. Give 3 short, actionable financial recommendation bullet points.
Format: use div, p, strong, ul, li, and inline styles (color: #ef4444 for danger, color: #10b981 for success).
`.trim();

      const result = await generateContentWithRetry(geminiModel, prompt);
      aiInsights = result.response.text().replace(/```html|```/g, '').trim();
    } catch (e) {
      console.error('Forecast Service: Gemini prompt failed. Using local insights.', e);
      aiInsights = generateLocalInsights(trendDirection, reg.slope, highestProjectedCategory, categoryRecommendations);
    }
  } else {
    aiInsights = generateLocalInsights(trendDirection, reg.slope, highestProjectedCategory, categoryRecommendations);
  }

  // Build historical summary for chart
  const historical = monthsList.map((monthStr) => {
    const target = new Date(monthStr + '-15');
    return {
      month: monthStr,
      label: target.toLocaleString('default', { month: 'short', year: '2-digit' }),
      spent: Math.round(monthlyTotals[monthStr]),
      budget: Math.round(
        budgets.filter((b) => b.month === monthStr).reduce((sum, b) => sum + b.limit, 0)
      ),
    };
  });

  return {
    slope: Math.round(reg.slope),
    trend: trendDirection,
    historical,
    projected: projectedMonths,
    recommendations: categoryRecommendations,
    insights: aiInsights,
  };
}

// ---------------------------------------------------------------------------
// Local insight generator (no Gemini)
// ---------------------------------------------------------------------------

function generateLocalInsights(trendDirection, slope, highestCat, recommendations) {
  let directionText = '';
  let trendColor = 'color: #38bdf8;';

  if (trendDirection === 'upward') {
    directionText = `Your overall cash outflow is on an <strong>upward trend</strong>, increasing by an average of <strong>₹${Math.round(slope)}</strong> per month. We recommend reviewing your optional categories.`;
    trendColor = 'color: #ef4444;';
  } else if (trendDirection === 'downward') {
    directionText = `Excellent work! Your monthly expenses are on a <strong>downward trend</strong>, decreasing by <strong>₹${Math.round(Math.abs(slope))}</strong> per month.`;
    trendColor = 'color: #10b981;';
  } else {
    directionText = `Your monthly spending is relatively <strong>stable</strong>, showing minor variations.`;
  }

  const overrunCats = recommendations.filter(
    (r) => r.projectedSpent > r.currentLimit && r.currentLimit > 0
  );
  let warningHtml = '';
  if (overrunCats.length > 0) {
    warningHtml = `
      <div style="margin-top:15px;padding:12px;background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.2);border-radius:8px;">
        <span style="color:#ef4444;font-weight:600;">⚠️ Budget Overrun Alerts:</span>
        <p style="margin-top:5px;font-size:13px;">
          Based on historical trends, you are projected to exceed your current budget limits in:
          <strong>${overrunCats.map((o) => o.category).join(', ')}</strong>.
          Consider adjusting limits or curtailing spending in these categories.
        </p>
      </div>`;
  }

  return `
    <div style="font-family:var(--font-sans);line-height:1.6;color:var(--text-primary);">
      <p style="margin-bottom:12px;font-size:14px;">${directionText}</p>
      <p style="margin-bottom:12px;font-size:14px;">
        The highest risk category predicted for the upcoming month is
        <strong style="color:var(--color-primary);">${highestCat?.category ?? 'None'}</strong>,
        with an estimated outflow of <strong>₹${highestCat?.projectedSpent ?? 0}</strong>.
        This is calculated using a Weighted Moving Average focusing on your most recent 3 months.
      </p>
      ${warningHtml}
      <div style="margin-top:15px;">
        <strong style="display:block;margin-bottom:8px;font-size:14px;">💡 Actionable Savings Guidance:</strong>
        <ul style="padding-left:20px;font-size:13px;">
          <li style="margin-bottom:6px;">
            <strong>Proactive Budget Adjustments</strong>: Click <em>"Apply All Recommended Budgets"</em> to align limits to real-world moving averages with a 10% safety buffer.
          </li>
          <li style="margin-bottom:6px;">
            <strong>Audit high-volatility items</strong>: Categories like <em>Shopping</em> and <em>Travel</em> fluctuate. Setting weekly sub-limits can stabilize your cash flow.
          </li>
          <li style="margin-bottom:6px;">
            <strong>Minimise subscriptions</strong>: Cancel unused streaming or utility subscriptions to pull your linear baseline down.
          </li>
        </ul>
      </div>
    </div>`;
}
