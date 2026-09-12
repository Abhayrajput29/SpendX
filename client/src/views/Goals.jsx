import React, { useCallback, useEffect, useState } from 'react';
import { 
  Target, Plus, Clock, Sparkles, TrendingUp, 
  Edit2, Trash2, PiggyBank, ShieldCheck, Car, Home, Plane, 
  GraduationCap, Smartphone
} from 'lucide-react';

const CATEGORY_ICONS = {
  Emergency: ShieldCheck,
  Travel: Plane,
  Vehicle: Car,
  Home: Home,
  Education: GraduationCap,
  Tech: Smartphone,
  General: PiggyBank
};

export default function Goals() {
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all, active, completed
  
  // Modals
  const [showModal, setShowModal] = useState(false);
  const [editingGoal, setEditingGoal] = useState(null);
  const [depositModalGoal, setDepositModalGoal] = useState(null);
  const [depositAmount, setDepositAmount] = useState('');
  
  // Form State
  const [form, setForm] = useState({
    name: '',
    targetAmount: '',
    currentAmount: '0',
    targetDate: '',
    frequency: 'Monthly',
    contributionAmount: '',
    category: 'General',
    color: '#866ec7',
    notes: ''
  });

  const [saving, setSaving] = useState(false);
  const [calculations, setCalculations] = useState(null);

  const fetchGoals = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/goals');
      if (res.ok) {
        const data = await res.json();
        setGoals(data);
      }
    } catch (err) {
      console.error('Failed to fetch goals:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGoals();
  }, [fetchGoals]);

  // Smart Auto-Calculation Engine
  useEffect(() => {
    const target = parseFloat(form.targetAmount) || 0;
    const current = parseFloat(form.currentAmount) || 0;
    const remaining = Math.max(0, target - current);

    if (remaining > 0 && form.targetDate) {
      const now = new Date();
      const targetDateObj = new Date(form.targetDate);
      const diffMs = targetDateObj - now;
      const diffDays = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
      const diffWeeks = Math.max(1, diffDays / 7);
      const diffMonths = Math.max(1, diffDays / 30.4375);
      const diffYears = Math.max(0.1, diffDays / 365.25);

      const perWeek = remaining / diffWeeks;
      const perMonth = remaining / diffMonths;
      const perYear = remaining / diffYears;

      setCalculations({
        days: diffDays,
        weeks: Math.round(diffWeeks * 10) / 10,
        months: Math.round(diffMonths * 10) / 10,
        years: Math.round(diffYears * 10) / 10,
        suggestedWeekly: Math.round(perWeek * 100) / 100,
        suggestedMonthly: Math.round(perMonth * 100) / 100,
        suggestedYearly: Math.round(perYear * 100) / 100
      });

      // Auto set contribution amount if user hasn't typed a custom override
      if (!editingGoal && !form.contributionAmount) {
        const defaultSuggested = form.frequency === 'Weekly' ? perWeek : (form.frequency === 'Yearly' ? perYear : perMonth);
        setForm(prev => ({ ...prev, contributionAmount: Math.round(defaultSuggested).toString() }));
      }
    } else {
      setCalculations(null);
    }
  }, [form.targetAmount, form.currentAmount, form.targetDate, form.frequency, editingGoal, form.contributionAmount]);

  const handleOpenCreateModal = () => {
    // Default target date to 6 months from today
    const sixMonthsLater = new Date();
    sixMonthsLater.setMonth(sixMonthsLater.getMonth() + 6);
    const defaultDate = sixMonthsLater.toISOString().split('T')[0];

    setEditingGoal(null);
    setForm({
      name: '',
      targetAmount: '50000',
      currentAmount: '0',
      targetDate: defaultDate,
      frequency: 'Monthly',
      contributionAmount: '',
      category: 'General',
      color: '#866ec7',
      notes: ''
    });
    setShowModal(true);
  };

  const handleOpenEditModal = (goal) => {
    setEditingGoal(goal);
    setForm({
      name: goal.name,
      targetAmount: goal.targetAmount.toString(),
      currentAmount: (goal.currentAmount || 0).toString(),
      targetDate: goal.targetDate,
      frequency: goal.frequency || 'Monthly',
      contributionAmount: (goal.contributionAmount || 0).toString(),
      category: goal.category || 'General',
      color: goal.color || '#866ec7',
      notes: goal.notes || ''
    });
    setShowModal(true);
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleApplySuggestion = (freq, amount) => {
    setForm(prev => ({
      ...prev,
      frequency: freq,
      contributionAmount: amount.toString()
    }));
  };

  const handleSubmitGoal = async (e) => {
    e.preventDefault();
    if (!form.name || !form.targetAmount || !form.targetDate) return;

    try {
      setSaving(true);
      const url = editingGoal ? `/api/goals/${editingGoal._id}` : '/api/goals';
      const method = editingGoal ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });

      if (res.ok) {
        setShowModal(false);
        fetchGoals();
      }
    } catch (err) {
      console.error('Failed to save goal:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteGoal = async (id) => {
    if (!window.confirm('Are you sure you want to delete this savings goal?')) return;
    try {
      const res = await fetch(`/api/goals/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setGoals(prev => prev.filter(g => g._id !== id));
      }
    } catch (err) {
      console.error('Failed to delete goal:', err);
    }
  };

  const handleContribute = async (e) => {
    e.preventDefault();
    if (!depositModalGoal || !depositAmount || parseFloat(depositAmount) <= 0) return;

    try {
      setSaving(true);
      const res = await fetch(`/api/goals/${depositModalGoal._id}/contribute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: parseFloat(depositAmount) })
      });

      if (res.ok) {
        setDepositModalGoal(null);
        setDepositAmount('');
        fetchGoals();
      }
    } catch (err) {
      console.error('Deposit error:', err);
    } finally {
      setSaving(false);
    }
  };

  // Stats calculation
  const totalTarget = goals.reduce((acc, g) => acc + (g.targetAmount || 0), 0);
  const totalSaved = goals.reduce((acc, g) => acc + (g.currentAmount || 0), 0);
  const overallPercentage = totalTarget > 0 ? Math.min(100, Math.round((totalSaved / totalTarget) * 100)) : 0;
  const completedCount = goals.filter(g => g.isCompleted || (g.currentAmount >= g.targetAmount)).length;

  const filteredGoals = goals.filter(g => {
    const isDone = g.isCompleted || (g.currentAmount >= g.targetAmount);
    if (filter === 'active') return !isDone;
    if (filter === 'completed') return isDone;
    return true;
  });

  return (
    <div>
      {/* View Header with Prominent + New Goal Button */}
      <div className="view-header">
        <div className="view-title-container">
          <h1 className="view-title">Savings Goals</h1>
          <p className="view-subtitle">Define financial targets with smart automated contribution calculators.</p>
        </div>
        <button 
          type="button" 
          className="btn btn-primary" 
          id="btn-add-goal"
          onClick={handleOpenCreateModal}
          style={{ padding: '10px 20px', fontSize: '14px', fontWeight: 600 }}
        >
          <Plus size={18} /> Add New Goal
        </button>
      </div>

      {/* KPI Stats Grid */}
      <div className="kpi-grid">
        <div className="card kpi-card">
          <div className="kpi-icon" style={{ backgroundColor: 'rgba(134, 110, 199, 0.15)', color: '#866ec7' }}>
            <PiggyBank size={24} />
          </div>
          <div className="kpi-details">
            <span className="kpi-label">Total Saved</span>
            <span className="kpi-value">₹{totalSaved.toLocaleString('en-IN')}</span>
          </div>
        </div>

        <div className="card kpi-card">
          <div className="kpi-icon" style={{ backgroundColor: 'rgba(16, 185, 129, 0.15)', color: '#10b981' }}>
            <Target size={24} />
          </div>
          <div className="kpi-details">
            <span className="kpi-label">Target Sum</span>
            <span className="kpi-value">₹{totalTarget.toLocaleString('en-IN')}</span>
          </div>
        </div>

        <div className="card kpi-card">
          <div className="kpi-icon" style={{ backgroundColor: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6' }}>
            <TrendingUp size={24} />
          </div>
          <div className="kpi-details">
            <span className="kpi-label">Overall Progress</span>
            <span className="kpi-value">{overallPercentage}% ({completedCount}/{goals.length} Goals)</span>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
        <button 
          className={`btn btn-sm ${filter === 'all' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setFilter('all')}
        >
          All Goals ({goals.length})
        </button>
        <button 
          className={`btn btn-sm ${filter === 'active' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setFilter('active')}
        >
          Active ({goals.length - completedCount})
        </button>
        <button 
          className={`btn btn-sm ${filter === 'completed' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setFilter('completed')}
        >
          Completed ({completedCount})
        </button>
      </div>

      {/* Goals Cards Grid */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: '#718096' }}>
          Loading your savings targets...
        </div>
      ) : filteredGoals.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '50px 20px' }}>
          <Target size={48} color="#866ec7" style={{ margin: '0 auto 16px', opacity: 0.8 }} />
          <h3 style={{ fontSize: '18px', fontWeight: 600, color: '#1e293b' }}>No savings goals found</h3>
          <p style={{ color: '#64748b', fontSize: '14px', maxWidth: '400px', margin: '8px auto 20px' }}>
            Create your first financial target! We will calculate exactly how much to save monthly, weekly, or yearly.
          </p>
          <button className="btn btn-primary" onClick={handleOpenCreateModal}>
            <Plus size={16} /> Create My First Goal
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '20px' }}>
          {filteredGoals.map(goal => {
            const current = goal.currentAmount || 0;
            const target = goal.targetAmount || 1;
            const pct = Math.min(100, Math.round((current / target) * 100));
            const isCompleted = goal.isCompleted || current >= target;
            const IconComponent = CATEGORY_ICONS[goal.category] || PiggyBank;

            // Target date calculations
            const targetDateObj = new Date(goal.targetDate);
            const formattedDate = targetDateObj.toLocaleDateString('default', { month: 'short', day: 'numeric', year: 'numeric' });
            const daysLeft = Math.ceil((targetDateObj - new Date()) / (1000 * 60 * 60 * 24));

            return (
              <div key={goal._id} className="card" style={{ padding: '22px', borderLeft: `5px solid ${goal.color || '#866ec7'}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ 
                      width: '42px', height: '42px', borderRadius: '10px', 
                      backgroundColor: `${goal.color || '#866ec7'}20`, 
                      color: goal.color || '#866ec7',
                      display: 'flex', alignItems: 'center', justifyContent: 'center' 
                    }}>
                      <IconComponent size={20} />
                    </div>
                    <div>
                      <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#0f172a', margin: 0 }}>{goal.name}</h3>
                      <span style={{ fontSize: '12px', color: '#64748b' }}>{goal.category}</span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button 
                      className="btn btn-sm btn-secondary" 
                      style={{ padding: '4px 8px' }} 
                      onClick={() => handleOpenEditModal(goal)}
                      title="Edit Goal"
                    >
                      <Edit2 size={13} />
                    </button>
                    <button 
                      className="btn btn-sm btn-outline-danger" 
                      style={{ padding: '4px 8px' }} 
                      onClick={() => handleDeleteGoal(goal._id)}
                      title="Delete Goal"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                {/* Progress Bar */}
                <div style={{ margin: '16px 0 12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '6px' }}>
                    <span style={{ fontWeight: 600, color: '#0f172a' }}>
                      ₹{current.toLocaleString('en-IN')} <span style={{ color: '#64748b', fontWeight: 400 }}>of ₹{target.toLocaleString('en-IN')}</span>
                    </span>
                    <span style={{ fontWeight: 700, color: isCompleted ? '#10b981' : '#866ec7' }}>
                      {pct}%
                    </span>
                  </div>

                  <div className="progress-track" style={{ height: '9px' }}>
                    <div 
                      className={`progress-fill ${isCompleted ? 'safe' : (pct > 50 ? 'safe' : 'warning')}`}
                      style={{ width: `${pct}%`, backgroundColor: isCompleted ? '#10b981' : (goal.color || '#866ec7') }}
                    />
                  </div>
                </div>

                {/* Contribution details & Target Date */}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', color: '#64748b', margin: '12px 0 16px', borderTop: '1px solid #f1f5f9', paddingTop: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <Clock size={14} />
                    <span>
                      {isCompleted ? 'Target Achieved! 🎉' : (daysLeft > 0 ? `${daysLeft} days remaining` : 'Due date passed')}
                    </span>
                  </div>
                  <div style={{ fontWeight: 500 }}>
                    Target: {formattedDate}
                  </div>
                </div>

                {/* Contribution pace */}
                {goal.contributionAmount > 0 && !isCompleted && (
                  <div style={{ background: '#f8fafc', padding: '8px 12px', borderRadius: '8px', fontSize: '12px', color: '#475569', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Sparkles size={14} color="#866ec7" />
                    <span>Save <strong>₹{goal.contributionAmount.toLocaleString('en-IN')}</strong> / {goal.frequency.toLowerCase()}</span>
                  </div>
                )}

                {/* Quick Add Funds Action */}
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button 
                    type="button" 
                    className="btn btn-secondary btn-sm" 
                    style={{ flex: 1 }}
                    onClick={() => {
                      setDepositModalGoal(goal);
                      setDepositAmount(goal.contributionAmount ? goal.contributionAmount.toString() : '500');
                    }}
                  >
                    + Add Deposit
                  </button>
                  <button 
                    type="button" 
                    className="btn btn-primary btn-sm" 
                    style={{ padding: '6px 12px' }}
                    onClick={() => {
                      setDepositModalGoal(goal);
                      setDepositAmount('1000');
                    }}
                  >
                    + ₹1,000
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── CREATE / EDIT GOAL MODAL WITH AUTO-CALCULATOR ── */}
      {showModal && (
        <div className="modal-overlay">
          <div className="card modal-content" style={{ maxWidth: '580px', padding: '28px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="card-header" style={{ marginBottom: '16px' }}>
              <h3 className="card-title">{editingGoal ? 'Edit Savings Goal' : 'Create New Savings Goal'}</h3>
              <button className="btn btn-sm btn-secondary" onClick={() => setShowModal(false)}>✕</button>
            </div>

            <form onSubmit={handleSubmitGoal}>
              <div className="form-group">
                <label>Goal Name *</label>
                <input 
                  type="text"
                  name="name"
                  value={form.name}
                  onChange={handleFormChange}
                  placeholder="e.g. Dream Vacation, New Car, Emergency Fund"
                  required
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Target Amount (₹) *</label>
                  <input 
                    type="number"
                    name="targetAmount"
                    value={form.targetAmount}
                    onChange={handleFormChange}
                    placeholder="100000"
                    min="1"
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Current Saved Amount (₹)</label>
                  <input 
                    type="number"
                    name="currentAmount"
                    value={form.currentAmount}
                    onChange={handleFormChange}
                    placeholder="0"
                    min="0"
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Target Completion Date *</label>
                  <input 
                    type="date"
                    name="targetDate"
                    value={form.targetDate}
                    onChange={handleFormChange}
                    min={new Date().toISOString().split('T')[0]}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Category</label>
                  <select name="category" value={form.category} onChange={handleFormChange}>
                    <option value="General">General Savings</option>
                    <option value="Emergency">Emergency Fund</option>
                    <option value="Travel">Travel & Vacation</option>
                    <option value="Vehicle">Vehicle / Car</option>
                    <option value="Home">Real Estate / Home</option>
                    <option value="Education">Education</option>
                    <option value="Tech">Gadgets & Tech</option>
                  </select>
                </div>
              </div>

              {/* ── AUTO-SUGGESTION CALCULATOR PANEL ── */}
              {calculations && (
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '16px', margin: '16px 0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', color: '#866ec7', fontWeight: 600, fontSize: '13.5px' }}>
                    <Sparkles size={16} />
                    <span>Smart Automated Savings Recommendation:</span>
                  </div>

                  <p style={{ fontSize: '12.5px', color: '#475569', marginBottom: '12px' }}>
                    To reach your target in <strong>{calculations.months} months</strong> ({calculations.weeks} weeks), select a recommended pace:
                  </p>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                    <button
                      type="button"
                      className={`btn btn-sm ${form.frequency === 'Weekly' ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ flexDirection: 'column', padding: '8px', fontSize: '11px', height: 'auto' }}
                      onClick={() => handleApplySuggestion('Weekly', calculations.suggestedWeekly)}
                    >
                      <span style={{ fontSize: '13px', fontWeight: 700 }}>₹{calculations.suggestedWeekly.toLocaleString('en-IN')}</span>
                      <span>Weekly</span>
                    </button>

                    <button
                      type="button"
                      className={`btn btn-sm ${form.frequency === 'Monthly' ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ flexDirection: 'column', padding: '8px', fontSize: '11px', height: 'auto' }}
                      onClick={() => handleApplySuggestion('Monthly', calculations.suggestedMonthly)}
                    >
                      <span style={{ fontSize: '13px', fontWeight: 700 }}>₹{calculations.suggestedMonthly.toLocaleString('en-IN')}</span>
                      <span>Monthly</span>
                    </button>

                    <button
                      type="button"
                      className={`btn btn-sm ${form.frequency === 'Yearly' ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ flexDirection: 'column', padding: '8px', fontSize: '11px', height: 'auto' }}
                      onClick={() => handleApplySuggestion('Yearly', calculations.suggestedYearly)}
                    >
                      <span style={{ fontSize: '13px', fontWeight: 700 }}>₹{calculations.suggestedYearly.toLocaleString('en-IN')}</span>
                      <span>Yearly</span>
                    </button>
                  </div>
                </div>
              )}

              <div className="form-row">
                <div className="form-group">
                  <label>Contribution Frequency (Manual)</label>
                  <select name="frequency" value={form.frequency} onChange={handleFormChange}>
                    <option value="Weekly">Weekly</option>
                    <option value="Monthly">Monthly</option>
                    <option value="Yearly">Yearly</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Amount to Save ({form.frequency})</label>
                  <input 
                    type="number"
                    name="contributionAmount"
                    value={form.contributionAmount}
                    onChange={handleFormChange}
                    placeholder="e.g. 5000"
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Notes (Optional)</label>
                <textarea 
                  name="notes"
                  value={form.notes}
                  onChange={handleFormChange}
                  placeholder="Motivation or notes about this goal..."
                  rows="2"
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '20px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Saving...' : (editingGoal ? 'Update Goal' : 'Save Goal')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── QUICK DEPOSIT MODAL ── */}
      {depositModalGoal && (
        <div className="modal-overlay">
          <div className="card modal-content" style={{ maxWidth: '420px', padding: '24px' }}>
            <h3 style={{ fontSize: '17px', fontWeight: 600, marginBottom: '8px', color: '#0f172a' }}>
              Add Funds to "{depositModalGoal.name}"
            </h3>
            <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '18px' }}>
              Current saved: ₹{(depositModalGoal.currentAmount || 0).toLocaleString('en-IN')} / Target: ₹{(depositModalGoal.targetAmount || 0).toLocaleString('en-IN')}
            </p>

            <form onSubmit={handleContribute}>
              <div className="form-group">
                <label>Deposit Amount (₹) *</label>
                <input 
                  type="number"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  placeholder="e.g. 1000"
                  min="1"
                  required
                  autoFocus
                />
              </div>

              <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                {['500', '1000', '5000', '10000'].map(val => (
                  <button 
                    key={val}
                    type="button"
                    className="btn btn-sm btn-secondary"
                    onClick={() => setDepositAmount(val)}
                  >
                    + ₹{parseInt(val).toLocaleString('en-IN')}
                  </button>
                ))}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setDepositModalGoal(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Depositing...' : 'Confirm Deposit'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
