import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { IndianRupee, Receipt, PiggyBank, Sparkles, Plus, ArrowRight, Wallet } from 'lucide-react';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, PointElement, LineElement, Title } from 'chart.js';
import { Doughnut, Bar } from 'react-chartjs-2';
import { sanitizeHtml } from '../utils/sanitizeHtml';

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, PointElement, LineElement, Title);

export default function Dashboard() {
  const [stats, setStats] = useState({
    totalSpent: 0,
    categoriesData: [],
    recentTransactions: [],
    transactionCount: 0
  });
  const [aiInsight, setAiInsight] = useState('');
  const [historyData, setHistoryData] = useState([]);
  const [loadingStats, setLoadingStats] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [loadingAi, setLoadingAi] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  
  // New transaction form state
  const [form, setForm] = useState({
    description: '',
    amount: '',
    category: '',
    paymentMethod: 'Cash',
    date: new Date().toISOString().split('T')[0],
    notes: ''
  });
  const [savingTransaction, setSavingTransaction] = useState(false);

  const currentMonth = new Date().toISOString().slice(0, 7); // "YYYY-MM"

  const fetchStats = async () => {
    try {
      setLoadingStats(true);
      const res = await fetch(`/api/dashboard/stats?month=${currentMonth}`);
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (err) {
      console.error('Failed to fetch dashboard stats:', err);
    } finally {
      setLoadingStats(false);
    }
  };

  const fetchAiInsight = async () => {
    try {
      setLoadingAi(true);
      const res = await fetch('/api/advisor/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month: currentMonth })
      });
      if (res.ok) {
        const data = await res.json();
        setAiInsight(data.html);
      } else {
        setAiInsight('<p>Unable to connect to AI Advisor. Set up GEMINI_API_KEY to start analyzing.</p>');
      }
    } catch (err) {
      console.error('Failed to fetch AI insights:', err);
      setAiInsight('<p>Offline Mode: AI Advisor is currently inactive.</p>');
    } finally {
      setLoadingAi(false);
    }
  };

  const fetchHistory = async () => {
    try {
      setLoadingHistory(true);
      const res = await fetch('/api/dashboard/history');
      if (res.ok) {
        const data = await res.json();
        setHistoryData(data);
      }
    } catch (err) {
      console.error('Failed to fetch dashboard history:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    fetchStats();
    fetchAiInsight();
    fetchHistory();
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    if (!form.description || !form.amount) return;

    try {
      setSavingTransaction(true);
      const res = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      if (res.ok) {
        setShowAddModal(false);
        setForm({
          description: '',
          amount: '',
          category: '',
          paymentMethod: 'Cash',
          date: new Date().toISOString().split('T')[0],
          notes: ''
        });
        // Refresh data
        fetchStats();
        fetchAiInsight();
      }
    } catch (err) {
      console.error('Failed to save transaction:', err);
    } finally {
      setSavingTransaction(false);
    }
  };

  // Helper to map category names to badge CSS classes
  const getBadgeClass = (category) => {
    const cat = category.toLowerCase();
    if (cat.includes('food')) return 'badge-food';
    if (cat.includes('transport') || cat.includes('auto')) return 'badge-transport';
    if (cat.includes('utility') || cat.includes('bill')) return 'badge-utilities';
    if (cat.includes('shopping')) return 'badge-shopping';
    if (cat.includes('entertainment')) return 'badge-entertainment';
    if (cat.includes('health') || cat.includes('fitness')) return 'badge-healthcare';
    if (cat.includes('education')) return 'badge-education';
    if (cat.includes('travel')) return 'badge-travel';
    return 'badge-misc';
  };

  // Prepare chart data
  const chartCategories = stats.categoriesData.filter(c => c.spent > 0);
  const doughnutData = {
    labels: chartCategories.map(c => c.category),
    datasets: [
      {
        data: chartCategories.map(c => c.spent),
        backgroundColor: [
          '#0284c7', // Food (deep blue)
          '#0ea5e9', // Transport (medium ice blue)
          '#38bdf8', // Utilities (light ice blue)
          '#0d9488', // Shopping (aurora teal)
          '#14b8a6', // Entertainment (teal)
          '#10b981', // Healthcare (emerald)
          '#34d399', // Education (light emerald)
          '#059669', // Travel (deep emerald)
          '#6b7280'  // Misc (grey)
        ],
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)'
      }
    ]
  };

  const doughnutOptions = {
    plugins: {
      legend: {
        position: 'right',
        labels: {
          color: '#e5e7eb',
          font: { family: 'Inter', size: 12 }
        }
      }
    },
    maintainAspectRatio: false
  };

  // Prepare 12-month budget vs actual comparison data
  const barChartData = {
    labels: historyData.map(h => h.label),
    datasets: [
      {
        type: 'bar',
        label: 'Actual Spent (₹)',
        data: historyData.map(h => h.spent),
        backgroundColor: 'rgba(14, 165, 233, 0.65)',
        borderColor: '#0ea5e9',
        borderWidth: 1,
        borderRadius: 4,
        order: 2
      },
      {
        type: 'line',
        label: 'Total Budget (₹)',
        data: historyData.map(h => h.budget),
        borderColor: '#10b981',
        borderWidth: 2,
        fill: false,
        pointBackgroundColor: '#10b981',
        pointBorderColor: '#10b981',
        pointRadius: 3,
        borderDash: [5, 5],
        order: 1
      }
    ]
  };

  const barChartOptions = {
    responsive: true,
    plugins: {
      legend: {
        labels: {
          color: '#e5e7eb',
          font: { family: 'Inter', size: 12 }
        }
      },
      tooltip: {
        callbacks: {
          label: function(context) {
            let label = context.dataset.label || '';
            if (label) {
              label += ': ';
            }
            if (context.parsed.y !== null) {
              label += '₹' + context.parsed.y.toLocaleString('en-IN');
            }
            return label;
          }
        }
      }
    },
    scales: {
      x: {
        grid: {
          display: false
        },
        ticks: {
          color: '#9ca3af',
          font: { family: 'Inter', size: 10 }
        }
      },
      y: {
        grid: {
          color: 'rgba(255, 255, 255, 0.05)'
        },
        ticks: {
          color: '#9ca3af',
          font: { family: 'Inter', size: 10 },
          callback: function(value) {
            return '₹' + value.toLocaleString('en-IN');
          }
        }
      }
    },
    maintainAspectRatio: false
  };

  return (
    <div>
      <div className="view-header">
        <div className="view-title-container">
          <h1 className="view-title">Financial Dashboard</h1>
          <p className="view-subtitle">Monitor and optimize your monthly budget in real time.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
          <Plus size={18} /> Quick Expense
        </button>
      </div>

      {/* KPI Cards Grid */}
      <div className="kpi-grid">
        <div className="card kpi-card">
          <div className="kpi-icon" style={{ backgroundColor: 'rgba(14, 165, 233, 0.15)', color: 'var(--color-primary)' }}>
            <IndianRupee size={24} />
          </div>
          <div className="kpi-details">
            <span className="kpi-label">Total Outflow ({new Date().toLocaleString('default', { month: 'long' })})</span>
            <span className="kpi-value">₹{stats.totalSpent.toFixed(2)}</span>
          </div>
        </div>

        <div className="card kpi-card">
          <div className="kpi-icon" style={{ backgroundColor: 'rgba(16, 185, 129, 0.15)', color: '#10b981' }}>
            <Receipt size={24} />
          </div>
          <div className="kpi-details">
            <span className="kpi-label">Transactions Tracked</span>
            <span className="kpi-value">{stats.transactionCount}</span>
          </div>
        </div>

        <div className="card kpi-card">
          <div className="kpi-icon" style={{ backgroundColor: 'rgba(13, 148, 136, 0.15)', color: 'var(--color-secondary)' }}>
            <Wallet size={24} />
          </div>
          <div className="kpi-details">
            <span className="kpi-label">Primary Method</span>
            <span className="kpi-value">
              {stats.recentTransactions.length > 0 ? stats.recentTransactions[0].paymentMethod : 'N/A'}
            </span>
          </div>
        </div>
      </div>

      {/* Main Dashboard Layout Grid */}
      <div className="dashboard-grid">
        {/* Left Side: 12-Month Outflow vs Budget comparison */}
        <div className="card chart-card">
          <h3 style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            12-Month Budget vs Spent
          </h3>
          <div style={{ height: '280px', position: 'relative' }}>
            {loadingHistory ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-secondary)' }}>
                Loading historical portfolio data...
              </div>
            ) : historyData.length > 0 ? (
              <Bar data={barChartData} options={barChartOptions} />
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-secondary)' }}>
                No history recorded.
              </div>
            )}
          </div>
        </div>

        {/* Right Side: AI Insights Panel */}
        <div className="card card-glowing" style={{ display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-primary)' }}>
            <Sparkles size={18} /> AI Financial Advisor
          </h3>
          
          <div style={{ flexGrow: 1, overflowY: 'auto', maxHeight: '250px', fontSize: '14px', lineHeight: '1.6' }}>
            {loadingAi ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '10px 0' }}>
                <div style={{ height: '14px', background: 'rgba(255, 255, 255, 0.05)', borderRadius: '4px', width: '90%', animation: 'pulse 1.5s infinite' }}></div>
                <div style={{ height: '14px', background: 'rgba(255, 255, 255, 0.05)', borderRadius: '4px', width: '80%', animation: 'pulse 1.5s infinite' }}></div>
                <div style={{ height: '14px', background: 'rgba(255, 255, 255, 0.05)', borderRadius: '4px', width: '60%', animation: 'pulse 1.5s infinite' }}></div>
              </div>
            ) : (
              <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(aiInsight) }} />
            )}
          </div>

          <Link to="/advisor" className="btn btn-secondary" style={{ marginTop: '16px', width: '100%', fontSize: '13px' }}>
            Consult Advisor <ArrowRight size={14} />
          </Link>
        </div>
      </div>

      {/* Bottom Grid: Category Distribution & Recent Transactions */}
      <div className="dashboard-grid-1-2" style={{ margin: '30px 0' }}>
        {/* Left Card: Category Distribution */}
        <div className="card chart-card">
          <h3 style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            Category Distribution
          </h3>
          <div style={{ height: '280px', position: 'relative' }}>
            {chartCategories.length > 0 ? (
              <Doughnut data={doughnutData} options={doughnutOptions} />
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-secondary)' }}>
                No spending recorded for this month yet.
              </div>
            )}
          </div>
        </div>

        {/* Right Card: Recent Transactions */}
        <div className="card" style={{ marginBottom: '0px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3>Recent Transactions</h3>
            <Link to="/transactions" style={{ color: 'var(--color-primary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', fontWeight: '500' }}>
              View All <ArrowRight size={14} />
            </Link>
          </div>

          <div className="table-container">
            {loadingStats ? (
              <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-secondary)' }}>Loading ledger...</div>
            ) : stats.recentTransactions.length > 0 ? (
              <table className="transaction-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Merchant / Description</th>
                    <th>Category</th>
                    <th>Payment Method</th>
                    <th>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.recentTransactions.map((tx) => (
                    <tr key={tx._id}>
                      <td>{new Date(tx.date).toLocaleDateString()}</td>
                      <td>
                        <div>
                          <strong>{tx.merchant || 'General Merchant'}</strong>
                          <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{tx.description}</div>
                        </div>
                      </td>
                      <td>
                        <span className={`badge ${getBadgeClass(tx.category)}`}>
                          {tx.category}
                        </span>
                      </td>
                      <td>{tx.paymentMethod}</td>
                      <td style={{ fontWeight: '600', color: 'var(--text-primary)' }}>
                        -₹{tx.amount.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-secondary)' }}>
                No transactions recorded yet. Scan a receipt or use Quick Expense above!
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quick Add Modal */}
      {showAddModal && (
        <div className="modal-overlay">
          <div className="card modal-content" style={{ padding: '30px', borderRadius: 'var(--radius-md)' }}>
            <h3 style={{ marginBottom: '20px' }}>Quick Expense Entry</h3>
            
            <form onSubmit={handleAddSubmit}>
              <div className="form-group">
                <label>Description *</label>
                <input 
                  type="text" 
                  name="description" 
                  value={form.description} 
                  onChange={handleInputChange}
                  placeholder="e.g. Starbucks Latte or Taxi ride"
                  required
                />
                <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  💡 Auto-categorization will run if category is left empty!
                </span>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Amount (₹) *</label>
                  <input 
                    type="number" 
                    step="0.01"
                    name="amount" 
                    value={form.amount} 
                    onChange={handleInputChange}
                    placeholder="0.00"
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Date</label>
                  <input 
                    type="date" 
                    name="date" 
                    value={form.date} 
                    onChange={handleInputChange}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Category (Optional)</label>
                  <select name="category" value={form.category} onChange={handleInputChange}>
                    <option value="">Auto-Detect (AI)</option>
                    <option value="Food & Dining">Food & Dining</option>
                    <option value="Transport & Auto">Transport & Auto</option>
                    <option value="Utilities & Bills">Utilities & Bills</option>
                    <option value="Shopping">Shopping</option>
                    <option value="Entertainment">Entertainment</option>
                    <option value="Healthcare & Fitness">Healthcare & Fitness</option>
                    <option value="Education">Education</option>
                    <option value="Travel">Travel</option>
                    <option value="Miscellaneous">Miscellaneous</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Payment Method</label>
                  <select name="paymentMethod" value={form.paymentMethod} onChange={handleInputChange}>
                    <option value="Cash">Cash</option>
                    <option value="Card">Card</option>
                    <option value="UPI">UPI</option>
                    <option value="NetBanking">NetBanking</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>Notes</label>
                <textarea 
                  name="notes" 
                  value={form.notes} 
                  onChange={handleInputChange} 
                  placeholder="Additional transaction info..."
                  rows="2"
                />
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '20px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={savingTransaction}>
                  {savingTransaction ? 'Saving...' : 'Add Expense'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
