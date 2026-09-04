import React, { useState, useEffect } from 'react';
import { 
  CalendarRange, Sparkles, Check, AlertCircle, Plus, Trash2, 
  Play, Pause, Calendar, Info, IndianRupee, Tv, Wifi, Car, 
  Utensils, ShoppingBag, HeartPulse, GraduationCap, Plane, 
  HelpCircle, Clock, CheckCircle2, AlertTriangle 
} from 'lucide-react';

const CATEGORIES = [
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

const getCategoryIcon = (category) => {
  switch (category) {
    case 'Food & Dining': return <Utensils size={18} />;
    case 'Transport & Auto': return <Car size={18} />;
    case 'Utilities & Bills': return <Wifi size={18} />;
    case 'Shopping': return <ShoppingBag size={18} />;
    case 'Entertainment': return <Tv size={18} />;
    case 'Healthcare & Fitness': return <HeartPulse size={18} />;
    case 'Education': return <GraduationCap size={18} />;
    case 'Travel': return <Plane size={18} />;
    default: return <HelpCircle size={18} />;
  }
};

const getCategoryColor = (category) => {
  switch (category) {
    case 'Food & Dining': return '#0284c7'; // deep blue
    case 'Transport & Auto': return '#0ea5e9'; // ice blue
    case 'Utilities & Bills': return '#38bdf8'; // light ice blue
    case 'Shopping': return '#0d9488'; // teal
    case 'Entertainment': return '#14b8a6'; // light teal
    case 'Healthcare & Fitness': return '#10b981'; // emerald
    case 'Education': return '#34d399'; // light emerald
    case 'Travel': return '#059669'; // deep emerald
    default: return '#6b7280'; // grey
  }
};

export default function Subscriptions() {
  const [subscriptions, setSubscriptions] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [avgMonthlySpent, setAvgMonthlySpent] = useState(42000);
  const [loading, setLoading] = useState(true);
  const [loadingDetect, setLoadingDetect] = useState(false);
  const [activeModal, setActiveModal] = useState(null); // 'subscription' | 'emi' | null
  const [submitting, setSubmitting] = useState(false);
  
  // Tab filtering state
  const [activeTab, setActiveTab] = useState('All');

  // Form State
  const [form, setForm] = useState({
    description: '',
    amount: '',
    category: 'Entertainment',
    merchant: '',
    billingCycle: 'monthly',
    nextDueDate: new Date().toISOString().slice(0, 10),
    paymentMethod: 'Card',
    isEMI: false,
    tenureMonths: 12,
    remainingMonths: 12
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      // Fetch Tracked Subscriptions
      const subsRes = await fetch('/api/subscriptions');
      if (subsRes.ok) {
        const subsData = await subsRes.json();
        setSubscriptions(subsData);
      }

      // Fetch all transactions to compute average monthly spent
      const txsRes = await fetch('/api/transactions');
      if (txsRes.ok) {
        const txsData = await txsRes.json();
        
        // Group by month and find average monthly spent
        const monthlySpentObj = {};
        txsData.forEach(t => {
          if (t.date) {
            const month = t.date.slice(0, 7);
            monthlySpentObj[month] = (monthlySpentObj[month] || 0) + t.amount;
          }
        });
        const months = Object.keys(monthlySpentObj);
        if (months.length > 0) {
          const total = months.reduce((sum, m) => sum + monthlySpentObj[m], 0);
          setAvgMonthlySpent(total / months.length);
        }
      }

      // Fetch algorithmic detected subscriptions
      setLoadingDetect(true);
      const detectRes = await fetch('/api/subscriptions/detect');
      if (detectRes.ok) {
        const detectData = await detectRes.json();
        setCandidates(detectData);
      }
    } catch (err) {
      console.error('Error fetching subscription data:', err);
    } finally {
      setLoading(false);
      setLoadingDetect(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm(prev => ({ 
      ...prev, 
      [name]: type === 'checkbox' ? checked : value 
    }));
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (!form.description || !form.amount || !form.nextDueDate) {
      alert('Please fill out description, amount, and next due date.');
      return;
    }

    try {
      setSubmitting(true);
      
      const payload = {
        ...form,
        amount: parseFloat(form.amount),
        isEMI: !!form.isEMI,
        tenureMonths: form.isEMI ? parseInt(form.tenureMonths || 12) : null,
        remainingMonths: form.isEMI ? parseInt(form.remainingMonths || 12) : null,
        billingCycle: form.isEMI ? 'monthly' : form.billingCycle
      };

      const res = await fetch('/api/subscriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        setActiveModal(null);
        setForm({
          description: '',
          amount: '',
          category: 'Entertainment',
          merchant: '',
          billingCycle: 'monthly',
          nextDueDate: new Date().toISOString().slice(0, 10),
          paymentMethod: 'Card',
          isEMI: false,
          tenureMonths: 12,
          remainingMonths: 12
        });
        fetchData();
      } else {
        alert('Failed to save subscription.');
      }
    } catch (err) {
      console.error(err);
      alert('Error saving subscription.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (id, currentStatus) => {
    const nextStatus = currentStatus === 'active' ? 'paused' : 'active';
    try {
      const res = await fetch('/api/subscriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          _id: id,
          status: nextStatus
        })
      });
      if (res.ok) {
        fetchData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteSub = async (id) => {
    if (!confirm('Are you sure you want to stop tracking this recurring payment?')) return;
    try {
      const res = await fetch(`/api/subscriptions/${id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        fetchData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleTrackCandidate = async (candidate) => {
    try {
      const res = await fetch('/api/subscriptions/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscriptions: [candidate] })
      });
      if (res.ok) {
        fetchData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const forceRunScheduler = async () => {
    try {
      const res = await fetch('/api/subscriptions/run-scheduler', {
        method: 'POST'
      });
      if (res.ok) {
        const result = await res.json();
        alert(`Checked successfully. Logged ${result.loggedTransactionsCount} due bills.`);
        fetchData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Helper: calculate days remaining until next due date
  const getDaysRemainingText = (dueDateStr) => {
    const diffTime = new Date(dueDateStr) - new Date();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return { text: 'Overdue', color: '#ef4444', class: 'overdue' };
    if (diffDays === 0) return { text: 'Due Today', color: '#f59e0b', class: 'due-today' };
    if (diffDays === 1) return { text: 'Due Tomorrow', color: '#f59e0b', class: 'due-tomorrow' };
    return { text: `Due in ${diffDays} days`, color: 'var(--text-secondary)', class: '' };
  };

  // Calculations
  const monthlyOverhead = subscriptions
    .filter(s => (s.status || 'active') === 'active')
    .reduce((sum, s) => {
      let monthlyAmt = s.amount;
      if (s.billingCycle === 'weekly') monthlyAmt *= 4.33; // approx weeks per month
      else if (s.billingCycle === 'yearly') monthlyAmt /= 12.0;
      return sum + monthlyAmt;
    }, 0);

  const activeCount = subscriptions.filter(s => (s.status || 'active') === 'active').length;
  const pausedCount = subscriptions.filter(s => (s.status || 'active') === 'paused').length;
  const completedCount = subscriptions.filter(s => (s.status || 'active') === 'completed').length;

  // Overhead ratio comparison against average spent
  const overheadRatio = Math.round((monthlyOverhead / (avgMonthlySpent || 1)) * 100);
  
  let auditStatus = 'Safe';
  let auditColor = '#10b981'; // green
  let auditIcon = <CheckCircle2 size={16} />;
  let auditText = 'Your committed overhead is well balanced against your discretionary spending.';

  if (overheadRatio >= 30 && overheadRatio < 50) {
    auditStatus = 'Moderate';
    auditColor = '#f59e0b'; // amber
    auditIcon = <AlertTriangle size={16} />;
    auditText = 'Committed bills consume a noticeable share of your outflow. Monitor future subscriptions.';
  } else if (overheadRatio >= 50) {
    auditStatus = 'High Overhead Warning';
    auditColor = '#ef4444'; // red
    auditIcon = <AlertCircle size={16} />;
    auditText = 'Over 50% of your outflow is locked in fixed commitments. Consider trimming subscription trials.';
  }

  // Filter subscriptions by selected tab category
  const filteredSubscriptions = subscriptions.filter(sub => {
    if (activeTab === 'All') return true;
    if (activeTab === 'EMIs / Loans') return !!sub.isEMI;
    if (activeTab === 'Utilities') return sub.category === 'Utilities & Bills' && !sub.isEMI;
    if (activeTab === 'Entertainment') return sub.category === 'Entertainment' && !sub.isEMI;
    return sub.category !== 'Utilities & Bills' && sub.category !== 'Entertainment' && !sub.isEMI;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
      
      {/* Header Panel */}
      <div className="view-header">
        <div>
          <h1 className="view-title">Recurring Bills & Subscriptions</h1>
          <p className="view-subtitle">Monitor committed expenditures and auto-log repeating invoices</p>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <button className="btn btn-secondary" onClick={forceRunScheduler} title="Check due bills and record them to ledger" style={{ fontSize: '12px' }}>
            Run Scheduler Check
          </button>
          <button 
            className="btn btn-secondary" 
            onClick={() => {
              setForm({
                description: '',
                amount: '',
                category: 'Entertainment',
                merchant: '',
                billingCycle: 'monthly',
                nextDueDate: new Date().toISOString().slice(0, 10),
                paymentMethod: 'Card',
                isEMI: false,
                tenureMonths: 12,
                remainingMonths: 12
              });
              setActiveModal('subscription');
            }} 
            style={{ display: 'flex', gap: '6px', alignItems: 'center', fontSize: '12px', borderColor: 'var(--border-light)' }}
          >
            <Plus size={14} /> Track Subscription
          </button>
          <button 
            className="btn btn-primary" 
            onClick={() => {
              setForm({
                description: '',
                amount: '',
                category: 'Utilities & Bills',
                merchant: '',
                billingCycle: 'monthly',
                nextDueDate: new Date().toISOString().slice(0, 10),
                paymentMethod: 'NetBanking',
                isEMI: true,
                tenureMonths: 12,
                remainingMonths: 12
              });
              setActiveModal('emi');
            }} 
            style={{ 
              display: 'flex', 
              gap: '6px', 
              alignItems: 'center', 
              fontSize: '12px',
              background: 'linear-gradient(90deg, #ec4899, #8b5cf6)',
              borderColor: 'transparent'
            }}
          >
            <Plus size={14} /> Track EMI / Loan
          </button>
        </div>
      </div>

      {/* Grid: Stats & Health Audit Card */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
        
        {/* Total Monthly Commitments Card */}
        <div className="card kpi-card" style={{ display: 'flex', gap: '16px' }}>
          <div className="kpi-icon" style={{ backgroundColor: 'rgba(16, 185, 129, 0.15)', color: '#10b981' }}>
            <IndianRupee size={24} />
          </div>
          <div className="kpi-details">
            <span className="kpi-label">Active Monthly Overhead</span>
            <span className="kpi-value" style={{ color: '#10b981' }}>
              ₹{Math.round(monthlyOverhead).toLocaleString('en-IN')}
            </span>
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px', display: 'block' }}>
              Committed fixed cost overhead
            </span>
          </div>
        </div>

        {/* Counts Card */}
        <div className="card kpi-card" style={{ display: 'flex', gap: '16px' }}>
          <div className="kpi-icon" style={{ backgroundColor: 'rgba(14, 165, 233, 0.15)', color: 'var(--color-primary)' }}>
            <CalendarRange size={24} />
          </div>
          <div className="kpi-details">
            <span className="kpi-label">Subscription Status</span>
            <span className="kpi-value">
              {activeCount} <span style={{ fontSize: '14px', fontWeight: 'normal', color: 'var(--text-secondary)' }}>Active</span>
              {pausedCount > 0 && <span style={{ fontSize: '14px', fontWeight: 'normal', color: '#f59e0b', marginLeft: '8px' }}>({pausedCount} Paused)</span>}
              {completedCount > 0 && <span style={{ fontSize: '14px', fontWeight: 'normal', color: '#10b981', marginLeft: '8px' }}>({completedCount} Paid Off)</span>}
            </span>
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px', display: 'block' }}>
              Tracked recurring contracts
            </span>
          </div>
        </div>

        {/* Health Audit Card */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: '600' }}>Overhead Health Audit</span>
            <span style={{ fontSize: '12px', fontWeight: 'bold', color: auditColor, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              {auditIcon} {auditStatus}
            </span>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '4px' }}>
            <span style={{ fontSize: '26px', fontWeight: 'bold', color: 'var(--text-primary)' }}>{overheadRatio}%</span>
            <div style={{ flexGrow: 1 }}>
              <div style={{ height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${Math.min(100, overheadRatio)}%`, backgroundColor: auditColor, borderRadius: '3px' }}></div>
              </div>
              <span style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '4px', display: 'block' }}>
                Ratio of average monthly spent (₹{Math.round(avgMonthlySpent).toLocaleString('en-IN')})
              </span>
            </div>
          </div>

          <p style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: '1.4', margin: 0 }}>
            {auditText}
          </p>
        </div>

      </div>

      {/* Algorithmic Candidate Suggestion Banner */}
      {candidates.length > 0 && (
        <div className="card card-glowing" style={{ border: '1px solid var(--border-accent)', background: 'radial-gradient(circle at 10% 20%, rgba(14, 165, 233, 0.04) 0%, transparent 60%)' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', color: 'var(--color-primary)' }}>
            <Sparkles size={20} fill="currentColor" /> Algorithmic Pattern Suggestions
          </h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '12px', marginBottom: '20px' }}>
            Our smart ledger scanner identified repeating payments in your history. Confirm below to track them and auto-log upcoming periods.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
            {candidates.map((cand, idx) => (
              <div key={idx} className="card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px', background: 'rgba(15, 23, 42, 0.4)', border: '1px solid var(--border-light)' }}>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <div style={{ padding: '8px', borderRadius: '8px', backgroundColor: 'rgba(14, 165, 233, 0.1)', color: 'var(--color-primary)' }}>
                    {getCategoryIcon(cand.category)}
                  </div>
                  <div style={{ flexGrow: 1, overflow: 'hidden' }}>
                    <h4 style={{ fontSize: '14px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{cand.description}</h4>
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Found in {cand.frequencyCount} ledger logs</span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '14px', fontWeight: 'bold' }}>₹{cand.amount}</span>
                    <span style={{ fontSize: '9px', display: 'block', color: 'var(--text-muted)' }}>/ {cand.billingCycle.slice(0, 3)}</span>
                  </div>
                </div>
                
                <div style={{ display: 'flex', justifySelf: 'flex-end', marginTop: '6px' }}>
                  <button 
                    className="btn btn-secondary" 
                    onClick={() => handleTrackCandidate(cand)}
                    style={{ width: '100%', fontSize: '11px', padding: '6px 0', border: '1px solid rgba(14, 165, 233, 0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                  >
                    <Check size={12} /> Confirm Subscription
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabs Filter Bar */}
      <div style={{ display: 'flex', gap: '10px', borderBottom: '1px solid var(--border-light)', paddingBottom: '12px' }}>
        {['All', 'Utilities', 'Entertainment', 'EMIs / Loans', 'Others'].map(tab => (
          <button
            key={tab}
            className={`btn ${activeTab === tab ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab(tab)}
            style={{ 
              padding: '6px 16px', 
              fontSize: '12px', 
              borderRadius: '20px',
              backgroundColor: activeTab === tab ? 'var(--color-primary)' : 'rgba(255, 255, 255, 0.02)',
              borderColor: activeTab === tab ? 'var(--color-primary)' : 'var(--border-light)'
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Grid: Modern Subscription Cards */}
      {filteredSubscriptions.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-secondary)' }}>
          <Calendar size={48} style={{ marginBottom: '16px', opacity: 0.3 }} />
          <h3>No subscriptions found</h3>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Try selecting a different tab filter or add a new contract card above.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
          {filteredSubscriptions.map(sub => {
            const due = getDaysRemainingText(sub.nextDueDate);
            const catColor = getCategoryColor(sub.category);
            const dailyCost = sub.billingCycle === 'weekly' 
              ? sub.amount / 7.0 
              : (sub.billingCycle === 'yearly' ? sub.amount / 365.0 : sub.amount / 30.0);
            
            return (
              <div 
                key={sub._id} 
                className="card card-glowing" 
                style={{ 
                  padding: '20px', 
                  display: 'flex', 
                  flexDirection: 'column', 
                  gap: '16px',
                  opacity: (sub.status || 'active') === 'paused' || (sub.status || 'active') === 'completed' ? 0.65 : 1,
                  borderLeft: `3px solid ${(sub.status || 'active') === 'completed' ? '#10b981' : ((sub.status || 'active') === 'paused' ? '#f59e0b' : catColor)}`
                }}
              >
                {/* Top Section */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <div style={{ 
                      padding: '10px', 
                      borderRadius: '10px', 
                      backgroundColor: 'rgba(255,255,255,0.02)', 
                      color: catColor,
                      border: '1px solid rgba(255,255,255,0.05)'
                    }}>
                      {getCategoryIcon(sub.category)}
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <h4 style={{ fontSize: '15px', fontWeight: '700' }}>{sub.description}</h4>
                        {sub.isEMI && (
                          <span style={{ 
                            fontSize: '9px', 
                            padding: '1px 6px', 
                            borderRadius: '10px', 
                            background: 'linear-gradient(90deg, #ec4899, #8b5cf6)', 
                            color: '#fff', 
                            fontWeight: 'bold' 
                          }}>EMI</span>
                        )}
                      </div>
                      <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                        {sub.merchant || 'General merchant'}
                      </span>
                    </div>
                  </div>
                  
                  {/* Status Indicator Lights */}
                  <span 
                    className={`badge ${(sub.status || 'active') === 'active' ? 'badge-success' : ((sub.status || 'active') === 'completed' ? 'badge-success' : 'badge-warning')}`} 
                    style={{ 
                      fontSize: '10px', 
                      padding: '3px 8px',
                      backgroundColor: (sub.status || 'active') === 'completed' ? 'rgba(16, 185, 129, 0.15)' : undefined,
                      color: (sub.status || 'active') === 'completed' ? '#10b981' : undefined,
                      border: (sub.status || 'active') === 'completed' ? '1px solid rgba(16, 185, 129, 0.3)' : undefined
                    }}
                  >
                    {(sub.status || 'active') === 'completed' ? 'PAID OFF' : (sub.status || 'active').toUpperCase()}
                  </span>
                </div>

                {/* Amount / Interval Specs */}
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center', 
                  backgroundColor: 'rgba(0,0,0,0.15)', 
                  padding: '12px 16px', 
                  borderRadius: '10px' 
                }}>
                  <div>
                    <span style={{ fontSize: '20px', fontWeight: '800', color: 'var(--text-primary)' }}>
                      ₹{sub.amount.toLocaleString('en-IN')}
                    </span>
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)', marginLeft: '4px', textTransform: 'lowercase' }}>
                      / {sub.billingCycle}
                    </span>
                  </div>
                  
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block' }}>Daily rate</span>
                    <strong style={{ fontSize: '12px', color: 'var(--text-primary)' }}>₹{dailyCost.toFixed(1)}/day</strong>
                  </div>
                </div>

                {/* EMI Progress Bar if applicable */}
                {sub.isEMI && sub.tenureMonths ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', margin: '-4px 0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-secondary)' }}>
                      <span>EMI Tenure Progress</span>
                      <strong>{sub.tenureMonths - (sub.remainingMonths || 0)} / {sub.tenureMonths} Mos Paid</strong>
                    </div>
                    <div style={{ height: '6px', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{ 
                        width: `${Math.min(100, Math.round(((sub.tenureMonths - (sub.remainingMonths || 0)) / sub.tenureMonths) * 100))}%`, 
                        height: '100%', 
                        background: 'linear-gradient(90deg, #ec4899, #8b5cf6)', 
                        borderRadius: '3px'
                      }} />
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', margin: '-4px 0', visibility: 'hidden' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                      <span>Spacer</span>
                      <strong>0 / 12 Mos Paid</strong>
                    </div>
                    <div style={{ height: '6px' }}></div>
                  </div>
                )}

                {/* Date & Remainder Timeline */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Next Billing Date:</span>
                    <span style={{ fontWeight: '600' }}>{new Date(sub.nextDueDate).toLocaleDateString()}</span>
                  </div>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', alignItems: 'center' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Time remaining:</span>
                    <span style={{ 
                      color: (sub.status || 'active') === 'active' ? due.color : 'var(--text-muted)',
                      fontWeight: '600',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}>
                      <Clock size={10} /> {
                        (sub.status || 'active') === 'completed' 
                          ? 'Contract Complete' 
                          : ((sub.status || 'active') === 'active' ? due.text : 'Subscription Paused')
                      }
                    </span>
                  </div>
                </div>

                {/* Actions Panel */}
                <div style={{ 
                  display: 'flex', 
                  gap: '10px', 
                  marginTop: '4px',
                  borderTop: '1px solid rgba(255,255,255,0.03)',
                  paddingTop: '14px'
                }}>
                  {(sub.status || 'active') !== 'completed' && (
                    <button 
                      className="btn btn-secondary" 
                      style={{ flexGrow: 1, padding: '8px 0', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                      onClick={() => handleToggleStatus(sub._id, sub.status || 'active')}
                    >
                      {(sub.status || 'active') === 'active' ? (
                        <>
                          <Pause size={14} /> Pause Billing
                        </>
                      ) : (
                        <>
                          <Play size={14} fill="currentColor" /> Resume billing
                        </>
                      )}
                    </button>
                  )}
                  
                  <button 
                    className="btn btn-secondary" 
                    style={{ 
                      padding: '8px 12px', 
                      color: 'var(--color-danger)', 
                      borderColor: 'rgba(239, 68, 68, 0.15)',
                      backgroundColor: 'rgba(239, 68, 68, 0.02)'
                    }}
                    onClick={() => handleDeleteSub(sub._id)}
                    title="Remove Tracker"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

              </div>
            );
          })}
        </div>
      )}

      {/* Add Subscription Modal Dialog */}
      {activeModal === 'subscription' && (
        <div className="modal-overlay">
          <div className="modal-content card" style={{ borderRadius: 'var(--radius-lg)', padding: '24px', maxWidth: '500px' }}>
            <h2 style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <CalendarRange size={24} color="var(--color-primary)" /> Track New Subscription
            </h2>
            
            <form onSubmit={handleFormSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="form-group">
                <label>Subscription Name</label>
                <input 
                  type="text" 
                  name="description" 
                  value={form.description} 
                  onChange={handleInputChange} 
                  placeholder="e.g. Netflix Premium, Spotify, Airtel Fiber"
                  required 
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group">
                  <label>Amount (₹)</label>
                  <input 
                    type="number" 
                    name="amount" 
                    value={form.amount} 
                    onChange={handleInputChange} 
                    placeholder="e.g. 649" 
                    required 
                  />
                </div>
                <div className="form-group">
                  <label>Billing Cycle</label>
                  <select name="billingCycle" value={form.billingCycle} onChange={handleInputChange}>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group">
                  <label>Category</label>
                  <select name="category" value={form.category} onChange={handleInputChange}>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Payment Method</label>
                  <select name="paymentMethod" value={form.paymentMethod} onChange={handleInputChange}>
                    <option value="Card">Card</option>
                    <option value="UPI">UPI autopay</option>
                    <option value="NetBanking">NetBanking</option>
                    <option value="Cash">Cash payment</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group">
                  <label>Next Billing Date</label>
                  <input 
                    type="date" 
                    name="nextDueDate" 
                    value={form.nextDueDate} 
                    onChange={handleInputChange} 
                    required 
                  />
                </div>
                <div className="form-group">
                  <label>Merchant (Optional)</label>
                  <input 
                    type="text" 
                    name="merchant" 
                    value={form.merchant} 
                    onChange={handleInputChange} 
                    placeholder="e.g. Netflix Inc" 
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '20px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setActiveModal(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Saving...' : 'Track Subscription'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add EMI / Loan Modal Dialog */}
      {activeModal === 'emi' && (
        <div className="modal-overlay">
          <div className="modal-content card" style={{ borderRadius: 'var(--radius-lg)', padding: '24px', maxWidth: '500px' }}>
            <h2 style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px', color: '#ec4899' }}>
              <IndianRupee size={24} color="#ec4899" /> Track New EMI / Loan
            </h2>
            
            <form onSubmit={handleFormSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="form-group">
                <label>EMI / Loan Description</label>
                <input 
                  type="text" 
                  name="description" 
                  value={form.description} 
                  onChange={handleInputChange} 
                  placeholder="e.g. Car Loan EMI, MacBook BuyNowPayLater"
                  required 
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group">
                  <label>Monthly Amount (₹)</label>
                  <input 
                    type="number" 
                    name="amount" 
                    value={form.amount} 
                    onChange={handleInputChange} 
                    placeholder="e.g. 2500" 
                    required 
                  />
                </div>
                <div className="form-group">
                  <label>Payment Channel</label>
                  <select name="paymentMethod" value={form.paymentMethod} onChange={handleInputChange}>
                    <option value="NetBanking">NetBanking (AutoDebit)</option>
                    <option value="UPI">UPI autopay</option>
                    <option value="Card">Card</option>
                    <option value="Cash">Cash</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group">
                  <label>Total Tenure (months)</label>
                  <input 
                    type="number" 
                    name="tenureMonths" 
                    value={form.tenureMonths} 
                    onChange={handleInputChange} 
                    placeholder="e.g. 12" 
                    min="1"
                    required 
                  />
                </div>
                <div className="form-group">
                  <label>Remaining Months</label>
                  <input 
                    type="number" 
                    name="remainingMonths" 
                    value={form.remainingMonths} 
                    onChange={handleInputChange} 
                    placeholder="e.g. 12" 
                    min="1"
                    max={form.tenureMonths}
                    required 
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group">
                  <label>Next Due Date</label>
                  <input 
                    type="date" 
                    name="nextDueDate" 
                    value={form.nextDueDate} 
                    onChange={handleInputChange} 
                    required 
                  />
                </div>
                <div className="form-group">
                  <label>Lender / Bank Brand (Optional)</label>
                  <input 
                    type="text" 
                    name="merchant" 
                    value={form.merchant} 
                    onChange={handleInputChange} 
                    placeholder="e.g. HDFC Bank, Bajaj Finserv" 
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Category</label>
                <select name="category" value={form.category} onChange={handleInputChange}>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '20px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setActiveModal(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" style={{ background: 'linear-gradient(90deg, #ec4899, #8b5cf6)', borderColor: 'transparent' }} disabled={submitting}>
                  {submitting ? 'Saving...' : 'Track EMI Loan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
