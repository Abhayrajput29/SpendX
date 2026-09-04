import React, { useState, useEffect } from 'react';
import { PiggyBank, Edit3, ShieldAlert, Sparkles, Check } from 'lucide-react';

const FRONTEND_CATEGORIES = [
  'Food & Dining',
  'Transport & Auto',
  'Utilities & Bills',
  'Shopping',
  'Entertainment',
  'Healthcare & Fitness',
  'Education',
  'Travel',
  'Miscellaneous'
];

export default function Budgets() {
  const [budgets, setBudgets] = useState([]);
  const [spentData, setSpentData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
  
  // Modal/Editing State
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState('');
  const [limitValue, setLimitValue] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchBudgetData = async () => {
    try {
      setLoading(true);
      // Fetch budget limits for this month
      const budgetRes = await fetch(`/api/budgets?month=${month}`);
      let budgetLimits = [];
      if (budgetRes.ok) {
        budgetLimits = await budgetRes.json();
      }

      // Fetch dashboard stats (contains actual spent for this month)
      const statsRes = await fetch(`/api/dashboard/stats?month=${month}`);
      let categorySpent = [];
      if (statsRes.ok) {
        const stats = await statsRes.json();
        categorySpent = stats.categoriesData || [];
      }

      // Assemble final data structure merging limit and spent
      const merged = FRONTEND_CATEGORIES.map(cat => {
        const budgetObj = budgetLimits.find(b => b.category === cat);
        const spentObj = categorySpent.find(s => s.category === cat);
        
        const limit = budgetObj ? budgetObj.limit : 0;
        const spent = spentObj ? spentObj.spent : 0;
        
        return {
          category: cat,
          limit: limit,
          spent: spent,
          percentage: limit > 0 ? (spent / limit) * 100 : 0
        };
      });

      setBudgets(merged);
    } catch (err) {
      console.error('Failed to load budget data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBudgetData();
  }, [month]);

  const handleEditClick = (cat, currentLimit) => {
    setEditingCategory(cat);
    setLimitValue(currentLimit || '');
    setShowEditModal(true);
  };

  const handleSaveBudget = async (e) => {
    e.preventDefault();
    if (!editingCategory || !limitValue) return;

    try {
      setSaving(true);
      const res = await fetch('/api/budgets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: editingCategory,
          limit: parseFloat(limitValue),
          month: month
        })
      });
      if (res.ok) {
        setShowEditModal(false);
        fetchBudgetData();
      }
    } catch (err) {
      console.error('Failed to update budget:', err);
    } finally {
      setSaving(false);
    }
  };

  // Helper to choose progress bar color based on percentage
  const getBarColor = (pct) => {
    if (pct === 0) return 'rgba(255, 255, 255, 0.1)';
    if (pct < 50) return 'var(--color-success)'; // Green
    if (pct <= 80) return 'var(--color-warning)'; // Orange/Yellow
    return 'var(--color-danger)'; // Red
  };

  const hasExceededBudget = budgets.some(b => b.limit > 0 && b.spent > b.limit);

  return (
    <div>
      <div className="view-header">
        <div className="view-title-container">
          <h1 className="view-title">Monthly Limits</h1>
          <p className="view-subtitle">Set monthly targets to curb extraneous spending habits.</p>
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: '600' }}>Month:</span>
          <input 
            type="month" 
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            style={{ padding: '8px 16px' }}
          />
        </div>
      </div>

      {hasExceededBudget && (
        <div className="card card-glowing" style={{ borderLeft: '4px solid var(--color-danger)', backgroundColor: 'rgba(239, 68, 68, 0.03)', padding: '16px 20px', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <ShieldAlert size={20} color="var(--color-danger)" />
          <div>
            <strong>Budget Overrun Alert!</strong> You have exceeded the set budget in one or more spending categories. Check details below.
          </div>
        </div>
      )}

      {loading ? (
        <div className="card" style={{ textAlign: 'center', padding: '40px' }}>Loading budget meters...</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '20px' }}>
          {budgets.map((b) => {
            const hasLimit = b.limit > 0;
            const pct = Math.min(b.percentage, 100);
            const remaining = b.limit - b.spent;

            return (
              <div key={b.category} className={`card ${b.limit > 0 && b.spent > b.limit ? 'card-glowing' : ''}`} style={{ display: 'flex', flexDirection: 'column', gap: '16px', position: 'relative' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ fontSize: '16px' }}>{b.category}</h3>
                  <button 
                    className="btn btn-secondary" 
                    onClick={() => handleEditClick(b.category, b.limit)}
                    style={{ padding: '6px 10px', borderRadius: 'var(--radius-sm)' }}
                  >
                    <Edit3 size={13} />
                  </button>
                </div>

                <div style={{ margin: '8px 0' }}>
                  <div className="budget-bar-bg">
                    <div 
                      className="budget-bar-fill" 
                      style={{ 
                        width: `${hasLimit ? pct : 0}%`, 
                        backgroundColor: getBarColor(b.percentage),
                        boxShadow: b.percentage > 80 ? '0 0 8px var(--color-danger)' : 'none'
                      }}
                    ></div>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'var(--text-secondary)' }}>
                  <div>
                    Spent: <strong style={{ color: 'var(--text-primary)' }}>₹{b.spent.toFixed(2)}</strong>
                  </div>
                  <div>
                    Limit: <strong style={{ color: 'var(--text-primary)' }}>{hasLimit ? `₹${b.limit.toFixed(2)}` : 'Not Set'}</strong>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', borderTop: '1px solid var(--border-light)', paddingTop: '12px', marginTop: '4px' }}>
                  {hasLimit ? (
                    remaining >= 0 ? (
                      <span style={{ color: 'var(--color-success)' }}>
                        ₹{remaining.toFixed(2)} remaining budget
                      </span>
                    ) : (
                      <span style={{ color: 'var(--color-danger)', fontWeight: '600' }}>
                        Over by ₹{Math.abs(remaining).toFixed(2)}
                      </span>
                    )
                  ) : (
                    <span style={{ color: 'var(--text-muted)' }}>No savings limit declared</span>
                  )}

                  {hasLimit && (
                    <span>
                      {Math.round(b.percentage)}% consumed
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit Budget Modal */}
      {showEditModal && (
        <div className="modal-overlay">
          <div className="card modal-content" style={{ padding: '30px', borderRadius: 'var(--radius-md)' }}>
            <h3 style={{ marginBottom: '10px' }}>Adjust Limit</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '20px' }}>
              Set budget target for <strong>{editingCategory}</strong> during {month}.
            </p>

            <form onSubmit={handleSaveBudget}>
              <div className="form-group">
                <label>Budget Limit (₹) *</label>
                <input 
                  type="number" 
                  step="1"
                  value={limitValue}
                  onChange={(e) => setLimitValue(e.target.value)}
                  placeholder="e.g. 500"
                  required
                  autoFocus
                />
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '20px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowEditModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Updating...' : 'Save Limit'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
