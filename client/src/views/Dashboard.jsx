import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { IndianRupee, Receipt, Sparkles, Plus, ArrowRight, Wallet, CalendarDays } from 'lucide-react';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
} from 'chart.js';
import { Doughnut, Bar } from 'react-chartjs-2';
import { sanitizeHtml } from '../utils/sanitizeHtml';
import { getBadgeClass } from '../utils/categoryStyles';
import { EXPENSE_CATEGORIES } from '../utils/categories';
import { useAuth } from '../context/AuthContext';

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, PointElement, LineElement);

const formatMoney = (amount) => new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
}).format(Number(amount) || 0);

const EMPTY_DASHBOARD_STATS = { totalSpent: 0, categoriesData: [], recentTransactions: [], transactionCount: 0 };
const GUEST_DASHBOARD_INSIGHT = '<h4>Portfolio Insights (Guest Preview)</h4><p>Total Spending: <strong>₹0.00</strong> across <strong>0</strong> transactions.</p><p>Sign in or sign up to record transactions, set budget targets, and get personalized AI advice.</p>';

export default function Dashboard({ darkMode }) {
  const navigate = useNavigate();
  const { isAuthenticated, requireAuth } = useAuth();

  const [storedStats, setStats] = useState({
    totalSpent: 0,
    categoriesData: [],
    recentTransactions: [],
    transactionCount: 0,
  });
  const [storedAiInsight, setAiInsight] = useState('');
  const [storedHistoryData, setHistoryData] = useState([]);
  const [loadingStats, setLoadingStats] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [loadingAi, setLoadingAi] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [savingTransaction, setSavingTransaction] = useState(false);
  const [form, setForm] = useState({
    description: '',
    amount: '',
    category: '',
    paymentMethod: 'Cash',
    date: new Date().toISOString().split('T')[0],
    notes: '',
  });

  const authEpochRef = useRef(0);
  const previousAuthRef = useRef(isAuthenticated);
  if (previousAuthRef.current !== isAuthenticated) {
    previousAuthRef.current = isAuthenticated;
    authEpochRef.current += 1;
  }
  const stats = isAuthenticated ? storedStats : EMPTY_DASHBOARD_STATS;
  const aiInsight = isAuthenticated ? storedAiInsight : GUEST_DASHBOARD_INSIGHT;
  const historyData = isAuthenticated ? storedHistoryData : [];

  const currentMonth = new Date().toISOString().slice(0, 7);
  const monthLabel = new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

  const fetchStats = useCallback(async () => {
    const requestEpoch = authEpochRef.current;
    try {
      setLoadingStats(true);
      const response = await fetch(`/api/dashboard/stats?month=${currentMonth}`);
      if (response.ok) {
        const data = await response.json();
        if (requestEpoch === authEpochRef.current) setStats(data);
      }
    } catch (error) {
      console.error('Failed to fetch dashboard stats:', error);
    } finally {
      if (requestEpoch === authEpochRef.current) setLoadingStats(false);
    }
  }, [currentMonth]);

  const fetchAiInsight = useCallback(async () => {
    const requestEpoch = authEpochRef.current;
    try {
      setLoadingAi(true);
      const response = await fetch('/api/advisor/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month: currentMonth }),
      });
      if (response.ok) {
        const data = await response.json();
        if (requestEpoch === authEpochRef.current) setAiInsight(data.html);
      } else {
        if (requestEpoch === authEpochRef.current) setAiInsight('<p>Unable to connect to the AI Advisor. Check your AI service setup to enable personalized insights.</p>');
      }
    } catch (error) {
      console.error('Failed to fetch AI insights:', error);
      if (requestEpoch === authEpochRef.current) setAiInsight('<p>The AI Advisor is offline. Your spending overview is still available.</p>');
    } finally {
      if (requestEpoch === authEpochRef.current) setLoadingAi(false);
    }
  }, [currentMonth]);

  const fetchHistory = useCallback(async () => {
    const requestEpoch = authEpochRef.current;
    try {
      setLoadingHistory(true);
      const response = await fetch('/api/dashboard/history');
      if (response.ok) {
        const data = await response.json();
        if (requestEpoch === authEpochRef.current) setHistoryData(data);
      }
    } catch (error) {
      console.error('Failed to fetch dashboard history:', error);
    } finally {
      if (requestEpoch === authEpochRef.current) setLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      void Promise.all([fetchStats(), fetchAiInsight(), fetchHistory()]);
    } else {
      setStats(EMPTY_DASHBOARD_STATS);
      setHistoryData([]);
      setAiInsight(GUEST_DASHBOARD_INSIGHT);
      setShowAddModal(false);
      setForm({ description: '', amount: '', category: '', paymentMethod: 'Cash', date: new Date().toISOString().split('T')[0], notes: '' });
      setLoadingStats(false);
      setLoadingHistory(false);
      setLoadingAi(false);
    }
  }, [isAuthenticated, fetchAiInsight, fetchHistory, fetchStats]);

  const handleInputChange = (event) => {
    const { name, value } = event.target;
    setForm((previous) => ({ ...previous, [name]: value }));
  };

  const handleAddSubmit = async (event) => {
    event.preventDefault();
    if (!form.description || !form.amount) return;

    try {
      setSavingTransaction(true);
      const response = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (response.ok) {
        setShowAddModal(false);
        setForm({
          description: '',
          amount: '',
          category: '',
          paymentMethod: 'Cash',
          date: new Date().toISOString().split('T')[0],
          notes: '',
        });
        void Promise.all([fetchStats(), fetchAiInsight(), fetchHistory()]);
      }
    } catch (error) {
      console.error('Failed to save transaction:', error);
    } finally {
      setSavingTransaction(false);
    }
  };

  const categories = Array.isArray(stats.categoriesData) ? stats.categoriesData : [];
  const chartCategories = categories.filter((category) => Number(category.spent) > 0);
  const totalSpent = Number(stats.totalSpent) || 0;
  const totalBudget = categories.reduce((sum, category) => sum + (Number(category.limit) || 0), 0);
  const budgetUsage = totalBudget > 0 ? Math.min(100, (totalSpent / totalBudget) * 100) : 0;
  const topCategory = [...chartCategories].sort((a, b) => Number(b.spent) - Number(a.spent))[0]?.category || '—';
  const budgetMessage = totalBudget === 0
    ? 'Set category limits to see your monthly budget progress.'
    : totalSpent > totalBudget
      ? `${formatMoney(totalSpent - totalBudget)} over your monthly budget`
      : `${formatMoney(totalBudget - totalSpent)} left in your monthly budget`;
  const chartTextColor = darkMode ? '#aab4bd' : '#687580';
  const chartGridColor = darkMode ? 'rgba(235,242,247,0.09)' : 'rgba(72,88,102,0.12)';

  const doughnutData = {
    labels: chartCategories.map((category) => category.category),
    datasets: [{
      data: chartCategories.map((category) => category.spent),
      backgroundColor: ['#d9f33f', '#9fb5c7', '#b7c7d4', '#7fa995', '#c7b895', '#8aa9d4', '#d6a98f', '#98a0a9', '#bcc6cc'],
      borderWidth: 3,
      borderColor: darkMode ? '#1a1f23' : '#f9fbfd',
    }],
  };

  const doughnutOptions = {
    responsive: true,
    animation: { duration: 0 },
    plugins: {
      legend: {
        position: 'right',
        labels: { color: chartTextColor, font: { family: 'Inter', size: 12 }, padding: 16, usePointStyle: true },
      },
    },
    maintainAspectRatio: false,
  };

  const barChartData = {
    labels: historyData.map((item) => item.label),
    datasets: [
      {
        type: 'bar',
        label: 'Spent',
        data: historyData.map((item) => item.spent),
        backgroundColor: historyData.map((_, index) => index === historyData.length - 1 ? '#d9f33f' : (darkMode ? '#45515a' : '#d2dce5')),
        borderColor: 'transparent',
        borderWidth: 0,
        borderRadius: 8,
        maxBarThickness: 38,
        order: 2,
      },
      {
        type: 'line',
        label: 'Budget',
        data: historyData.map((item) => item.budget),
        borderColor: darkMode ? '#aab4bd' : '#6c7883',
        borderWidth: 2,
        fill: false,
        pointBackgroundColor: darkMode ? '#aab4bd' : '#6c7883',
        pointBorderColor: darkMode ? '#aab4bd' : '#6c7883',
        pointRadius: 3,
        borderDash: [5, 5],
        order: 1,
      },
    ],
  };

  const barChartOptions = {
    responsive: true,
    animation: { duration: 0 },
    plugins: {
      legend: { labels: { color: chartTextColor, font: { family: 'Inter', size: 12 }, usePointStyle: true, padding: 18 } },
      tooltip: {
        callbacks: {
          label: (context) => `${context.dataset.label}: ${formatMoney(context.parsed.y)}`,
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: chartTextColor, font: { family: 'Inter', size: 10 } },
      },
      y: {
        grid: { color: chartGridColor },
        ticks: {
          color: chartTextColor,
          font: { family: 'Inter', size: 10 },
          callback: (value) => `₹${Number(value).toLocaleString('en-IN')}`,
        },
      },
    },
    maintainAspectRatio: false,
  };

  return (
    <div className="dashboard-page">
      <div className="view-header dashboard-header">
        <div className="view-title-container">
          <span className="dashboard-eyebrow">Your finances</span>
          <h1 className="view-title">Financial Overview</h1>
          <p className="view-subtitle">Your money, at a glance.</p>
        </div>
        <div className="dashboard-header-actions">
          <div className="dashboard-month-chip">
            <CalendarDays size={16} aria-hidden="true" />
            <span>{monthLabel}</span>
          </div>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => requireAuth(() => setShowAddModal(true), 'Sign in to record your spending and track category budgets')}
          >
            <Plus size={17} aria-hidden="true" /> Add expense
          </button>
        </div>
      </div>

      <section className="kpi-grid dashboard-kpis" aria-label="Monthly summary">
        <article className="card kpi-card dashboard-kpi-card">
          <div className="kpi-icon"><IndianRupee size={21} aria-hidden="true" /></div>
          <div className="kpi-details">
            <span className="kpi-label">Money out</span>
            <span className="kpi-value">{formatMoney(totalSpent)}</span>
            <span className="kpi-note">Spent this month</span>
          </div>
        </article>
        <article className="card kpi-card dashboard-kpi-card">
          <div className="kpi-icon"><Receipt size={21} aria-hidden="true" /></div>
          <div className="kpi-details">
            <span className="kpi-label">Transactions</span>
            <span className="kpi-value">{stats.transactionCount}</span>
            <span className="kpi-note">Recorded this month</span>
          </div>
        </article>
        <article className="card kpi-card dashboard-kpi-card">
          <div className="kpi-icon"><Wallet size={21} aria-hidden="true" /></div>
          <div className="kpi-details">
            <span className="kpi-label">Top category</span>
            <span className="kpi-value kpi-value-category">{topCategory}</span>
            <span className="kpi-note">By monthly spend</span>
          </div>
        </article>
      </section>

      <section className="dashboard-grid dashboard-main-grid" aria-label="Spending overview">
        <article className="card chart-card dashboard-chart-card">
          <div className="dashboard-card-heading">
            <div>
              <h2>Expense statistics</h2>
              <p>Monthly spend compared with your budget</p>
            </div>
            <span className="dashboard-chart-period">Last 12 months</span>
          </div>
          <div className="dashboard-chart-area">
            {loadingHistory ? (
              <div className="dashboard-empty-state">Loading your spending history…</div>
            ) : historyData.some((item) => Number(item.spent) > 0 || Number(item.budget) > 0) ? (
              <Bar data={barChartData} options={barChartOptions} />
            ) : (
              <div className="dashboard-empty-state">Add an expense or set a budget to see your monthly history.</div>
            )}
          </div>
        </article>

        <div className="dashboard-side-stack">
          <article className="card dashboard-card budget-card">
            <div className="dashboard-card-heading">
              <div>
                <h2>Monthly budget</h2>
                <p>Spending against category limits</p>
              </div>
              <button
                type="button"
                className="dashboard-text-link"
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }}
                onClick={() => requireAuth(() => navigate('/budgets'), 'Sign in to configure category budget limits')}
              >
                Manage
              </button>
            </div>
            <div className="budget-total-row">
              <div>
                <span className="dashboard-meta-label">Total spent</span>
                <strong>{formatMoney(totalSpent)}</strong>
              </div>
              <div className="budget-limit-value">
                <span className="dashboard-meta-label">Budget</span>
                <strong>{totalBudget > 0 ? formatMoney(totalBudget) : 'Not set'}</strong>
              </div>
            </div>
            <div
              className="budget-progress-track"
              role="progressbar"
              aria-label="Monthly budget used"
              aria-valuemin="0"
              aria-valuemax="100"
              aria-valuenow={Math.round(budgetUsage)}
            >
              <span style={{ width: `${budgetUsage}%` }} />
            </div>
            <div className="budget-progress-caption">
              <span>{totalBudget > 0 ? `${Math.round(budgetUsage)}% used` : 'No limits yet'}</span>
              <span>{budgetMessage}</span>
            </div>
          </article>

          <article className="card dashboard-card dashboard-ai-card">
            <div className="dashboard-card-heading">
              <div>
                <h2><Sparkles size={17} aria-hidden="true" /> AI insight</h2>
                <p>A quick read on this month</p>
              </div>
              <span className="dashboard-ai-mark" aria-hidden="true"><Sparkles size={15} /></span>
            </div>
            <div className="dashboard-ai-preview">
              {loadingAi ? (
                <div className="dashboard-ai-loading" aria-label="Loading AI insight">
                  <span /><span /><span />
                </div>
              ) : (
                <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(aiInsight) }} />
              )}
            </div>
            <button
              type="button"
              className="dashboard-text-link dashboard-ai-link"
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left' }}
              onClick={() => requireAuth(() => navigate('/advisor'), 'Sign in to consult the SpendX AI Advisor')}
            >
              Open AI advisor <ArrowRight size={15} aria-hidden="true" />
            </button>
          </article>
        </div>
      </section>

      <section className="dashboard-grid-1-2 dashboard-lower-grid" aria-label="Category and transaction details">
        <article className="card chart-card dashboard-card dashboard-category-card">
          <div className="dashboard-card-heading">
            <div>
              <h2>Category breakdown</h2>
              <p>Where your spending goes</p>
            </div>
          </div>
          <div className="dashboard-doughnut-area">
            {chartCategories.length > 0 ? (
              <Doughnut data={doughnutData} options={doughnutOptions} />
            ) : (
              <div className="dashboard-empty-state">No spending recorded this month yet.</div>
            )}
          </div>
        </article>

        <article className="card dashboard-card dashboard-transactions-card">
          <div className="dashboard-card-heading">
            <div>
              <h2>Recent transactions</h2>
              <p>Your latest activity</p>
            </div>
            <Link to="/transactions" className="dashboard-text-link">
              View all <ArrowRight size={15} aria-hidden="true" />
            </Link>
          </div>
          <div className="table-container">
            {loadingStats ? (
              <div className="dashboard-empty-state">Loading transactions…</div>
            ) : stats.recentTransactions.length > 0 ? (
              <table className="transaction-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Merchant / description</th>
                    <th>Category</th>
                    <th>Payment method</th>
                    <th>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.recentTransactions.map((transaction) => (
                    <tr key={transaction._id}>
                      <td>{new Date(transaction.date).toLocaleDateString()}</td>
                      <td>
                        <div>
                          <strong>{transaction.merchant || 'General merchant'}</strong>
                          <div className="transaction-subtext">{transaction.description}</div>
                        </div>
                      </td>
                      <td><span className={`badge ${getBadgeClass(transaction.category)}`}>{transaction.category}</span></td>
                      <td>{transaction.paymentMethod}</td>
                      <td className="transaction-amount">−{formatMoney(transaction.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="dashboard-empty-state">No transactions yet. Add an expense or scan a receipt to get started.</div>
            )}
          </div>
        </article>
      </section>

      {isAuthenticated && showAddModal && (
        <div className="modal-overlay">
          <div className="card modal-content dashboard-expense-modal" role="dialog" aria-modal="true" aria-labelledby="add-expense-title">
            <h2 id="add-expense-title">Add an expense</h2>
            <p className="view-subtitle">Record a payment and keep your monthly overview up to date.</p>
            <form onSubmit={handleAddSubmit}>
              <div className="form-group">
                <label htmlFor="quick-description">Description *</label>
                <input
                  id="quick-description"
                  type="text"
                  name="description"
                  value={form.description}
                  onChange={handleInputChange}
                  placeholder="e.g. Coffee or taxi ride"
                  required
                />
                <span className="quick-expense-hint">Leave category blank to let automatic categorization choose one.</span>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="quick-amount">Amount (₹) *</label>
                  <input id="quick-amount" type="number" step="0.01" min="0.01" name="amount" value={form.amount} onChange={handleInputChange} placeholder="0.00" required />
                </div>
                <div className="form-group">
                  <label htmlFor="quick-date">Date</label>
                  <input id="quick-date" type="date" name="date" value={form.date} onChange={handleInputChange} />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="quick-category">Category</label>
                  <select id="quick-category" name="category" value={form.category} onChange={handleInputChange}>
                    <option value="">Auto-detect</option>
                    {EXPENSE_CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label htmlFor="quick-payment-method">Payment method</label>
                  <select id="quick-payment-method" name="paymentMethod" value={form.paymentMethod} onChange={handleInputChange}>
                    <option value="Cash">Cash</option>
                    <option value="Card">Card</option>
                    <option value="UPI">UPI</option>
                    <option value="NetBanking">NetBanking</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="quick-notes">Notes</label>
                <textarea id="quick-notes" name="notes" value={form.notes} onChange={handleInputChange} placeholder="Optional details" rows="2" />
              </div>

              <div className="dashboard-modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={savingTransaction}>
                  {savingTransaction ? 'Saving…' : 'Add expense'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
