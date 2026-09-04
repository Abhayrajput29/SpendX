import React, { useState, useEffect } from 'react';
import { TrendingUp, Sparkles, Check, AlertCircle, Calendar, ArrowUpRight, ArrowDownRight, IndianRupee } from 'lucide-react';
import { Line } from 'react-chartjs-2';
import { sanitizeHtml } from '../utils/sanitizeHtml';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler } from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

export default function Forecast() {
  const [forecast, setForecast] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [applying, setApplying] = useState(false);
  const [appliedSuccess, setAppliedSuccess] = useState(false);

  const fetchForecast = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await fetch('/api/dashboard/forecast');
      if (res.ok) {
        const data = await res.json();
        setForecast(data);
      } else {
        const errData = await res.json();
        setError(errData.error || 'Failed to fetch forecasting data');
      }
    } catch (err) {
      console.error('Forecast load error:', err);
      setError('Failed to reach backend server. Please verify Express is online.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchForecast();
  }, []);

  const handleApplyRecommendedBudgets = async () => {
    if (!forecast || !forecast.recommendations || forecast.recommendations.length === 0) return;
    
    const nextMonthStr = forecast.projected[0]?.month;
    if (!nextMonthStr) return;

    try {
      setApplying(true);
      setAppliedSuccess(false);

      const recommendationsPayload = forecast.recommendations.map(r => ({
        category: r.category,
        limit: r.recommendedLimit,
        month: nextMonthStr
      }));

      const res = await fetch('/api/budgets/apply-recommendations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recommendations: recommendationsPayload })
      });

      if (res.ok) {
        setAppliedSuccess(true);
        setTimeout(() => setAppliedSuccess(false), 4000);
        fetchForecast();
      } else {
        alert('Failed to apply recommended budgets.');
      }
    } catch (err) {
      console.error('Apply budgets error:', err);
      alert('Error communicating with backend database.');
    } finally {
      setApplying(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '80vh', gap: '16px' }}>
        <div style={{ width: '40px', height: '40px', border: '3px solid rgba(14, 165, 233, 0.2)', borderTopColor: 'var(--color-primary)', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
        <p style={{ color: 'var(--text-secondary)' }}>Calculating regression matrices and cash flow projections...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card" style={{ padding: '30px', textAlign: 'center', maxWidth: '500px', margin: '100px auto' }}>
        <AlertCircle size={48} color="var(--color-danger)" style={{ marginBottom: '16px' }} />
        <h3 style={{ marginBottom: '12px' }}>Forecasting Offline</h3>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '20px' }}>{error}</p>
        <button className="btn btn-primary" onClick={fetchForecast}>Retry Calculation</button>
      </div>
    );
  }

  // Prep Chart.js datasets
  const historical = forecast?.historical || [];
  const projected = forecast?.projected || [];

  const allLabels = [
    ...historical.map(h => h.label),
    ...projected.map(p => p.label)
  ];

  const historicalData = [
    ...historical.map(h => h.spent),
    ...projected.map(() => null)
  ];

  const lastHistSpent = historical[historical.length - 1]?.spent || null;
  const projectedData = [
    ...historical.slice(0, -1).map(() => null),
    lastHistSpent,
    ...projected.map(p => p.projectedSpent)
  ];

  const budgetData = [
    ...historical.map(h => h.budget),
    ...projected.map(p => p.recommendedBudget)
  ];

  const chartData = {
    labels: allLabels,
    datasets: [
      {
        label: 'Actual Spent (₹)',
        data: historicalData,
        borderColor: '#0ea5e9', // Glacial Ice Blue
        backgroundColor: 'rgba(14, 165, 233, 0.05)',
        borderWidth: 3,
        pointBackgroundColor: '#0ea5e9',
        pointBorderColor: '#0ea5e9',
        pointHoverRadius: 6,
        fill: true,
        tension: 0.35
      },
      {
        label: 'Projected Outflow (₹)',
        data: projectedData,
        borderColor: '#0d9488', // Aurora Teal
        borderDash: [6, 4],
        borderWidth: 3,
        pointBackgroundColor: '#0d9488',
        pointBorderColor: '#0d9488',
        pointHoverRadius: 6,
        fill: false,
        tension: 0.35
      },
      {
        label: 'Budget Limit (₹)',
        data: budgetData,
        borderColor: '#f59e0b', // Amber
        borderDash: [3, 3],
        borderWidth: 2,
        pointStyle: 'circle',
        pointRadius: 0,
        fill: false,
        tension: 0.1
      }
    ]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        labels: {
          color: '#f3f4f6',
          font: { family: 'Outfit', size: 12 },
          usePointStyle: true,
          padding: 15
        }
      },
      tooltip: {
        backgroundColor: '#070b19',
        borderColor: 'rgba(255, 255, 255, 0.1)',
        borderWidth: 1,
        titleColor: '#f3f4f6',
        bodyColor: '#9ca3af',
        bodyFont: { family: 'Inter' },
        titleFont: { family: 'Outfit', weight: 'bold' }
      }
    },
    scales: {
      x: {
        grid: { color: 'rgba(255, 255, 255, 0.02)' },
        ticks: { color: '#9ca3af', font: { family: 'Inter', size: 11 } }
      },
      y: {
        grid: { color: 'rgba(255, 255, 255, 0.05)' },
        ticks: { 
          color: '#9ca3af', 
          font: { family: 'Inter', size: 11 },
          callback: (value) => '₹' + value.toLocaleString('en-IN')
        }
      }
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
      
      {/* Header Panel */}
      <div className="view-header">
        <div>
          <h1 className="view-title">Predictive Analytics</h1>
          <p className="view-subtitle">AI-assisted OLS cash flow projections & automated budget targets</p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button 
            className={`btn ${appliedSuccess ? 'btn-success' : 'btn-primary'}`} 
            onClick={handleApplyRecommendedBudgets}
            disabled={applying}
            style={{ display: 'flex', gap: '8px', alignItems: 'center' }}
          >
            {appliedSuccess ? (
              <>
                <Check size={18} /> Budgets Applied!
              </>
            ) : (
              <>
                <Calendar size={18} /> 
                {applying ? 'Applying Budgets...' : 'Apply Recommended Budgets'}
              </>
            )}
          </button>
        </div>
      </div>

      {/* KPI Stats Row */}
      <div className="kpi-grid">
        
        <div className="card kpi-card">
          <div className="kpi-icon" style={{ backgroundColor: 'rgba(14, 165, 233, 0.15)', color: 'var(--color-primary)' }}>
            <TrendingUp size={24} />
          </div>
          <div className="kpi-details">
            <span className="kpi-label">Upcoming Month Forecast</span>
            <span className="kpi-value" style={{ color: 'var(--text-primary)' }}>
              ₹{(projected[0]?.projectedSpent || 0).toLocaleString('en-IN')}
            </span>
          </div>
        </div>

        <div className="card kpi-card">
          <div className="kpi-icon" style={{ backgroundColor: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b' }}>
            <IndianRupee size={24} />
          </div>
          <div className="kpi-details">
            <span className="kpi-label">Recommended Next Month Limit</span>
            <span className="kpi-value" style={{ color: '#f59e0b' }}>
              ₹{(projected[0]?.recommendedBudget || 0).toLocaleString('en-IN')}
            </span>
          </div>
        </div>

        <div className="card kpi-card">
          <div className="kpi-icon" style={{ 
            backgroundColor: forecast.trend === 'downward' ? 'rgba(16, 185, 129, 0.15)' : (forecast.trend === 'upward' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(14, 165, 233, 0.15)'), 
            color: forecast.trend === 'downward' ? '#10b981' : (forecast.trend === 'upward' ? '#ef4444' : 'var(--color-primary)') 
          }}>
            {forecast.trend === 'downward' ? <ArrowDownRight size={24} /> : <ArrowUpRight size={24} />}
          </div>
          <div className="kpi-details">
            <span className="kpi-label">Expenditure Trajectory</span>
            <span className="kpi-value" style={{ 
              color: forecast.trend === 'downward' ? '#10b981' : (forecast.trend === 'upward' ? '#ef4444' : 'var(--text-primary)') 
            }}>
              {forecast.trend.charAt(0).toUpperCase() + forecast.trend.slice(1)}
              <span style={{ fontSize: '11px', display: 'block', fontWeight: 'normal', color: 'var(--text-secondary)', marginTop: '2px' }}>
                {forecast.slope > 0 ? '+' : ''}₹{forecast.slope}/month
              </span>
            </span>
          </div>
        </div>

      </div>

      {/* Grid: Full Width Chart */}
      <div style={{ width: '100%' }}>
        <div className="card chart-card" style={{ padding: '24px' }}>
          <h3 style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            12-Month Outflow & 3-Month Projection
          </h3>
          <div style={{ height: '360px', position: 'relative' }}>
            <Line data={chartData} options={chartOptions} />
          </div>
        </div>
      </div>

      {/* Row 3: AI Insights & Recommendation Ledger grid */}
      <div className="dashboard-grid">
        
        {/* Left: Budget targets ledger */}
        <div className="card" style={{ flexGrow: 2 }}>
          <h3 style={{ marginBottom: '12px' }}>
            Category budget recommendations for {projected[0]?.label}
          </h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '12px', marginBottom: '20px' }}>
            We calculate category-level projections using a 3-Month Weighted Moving Average. Recommended limits are padded with a +10% safety margin.
          </p>

          <div style={{ overflowX: 'auto' }}>
            <table className="transaction-table">
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Avg Spent</th>
                  <th>Projected Spent</th>
                  <th>Current Limit</th>
                  <th>Recommended Limit</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {forecast.recommendations.map((rec, idx) => {
                  const diff = rec.projectedSpent - rec.currentLimit;
                  const isOverrun = diff > 0 && rec.currentLimit > 0;
                  
                  return (
                    <tr key={idx}>
                      <td style={{ fontWeight: '600' }}>{rec.category}</td>
                      <td>₹{rec.historicalAvgSpent.toLocaleString('en-IN')}</td>
                      <td style={{ color: isOverrun ? '#ef4444' : 'var(--text-primary)', fontWeight: isOverrun ? '600' : 'normal' }}>
                        ₹{rec.projectedSpent.toLocaleString('en-IN')}
                      </td>
                      <td>
                        {rec.currentLimit > 0 ? (
                          `₹${rec.currentLimit.toLocaleString('en-IN')}`
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>Not Set</span>
                        )}
                      </td>
                      <td style={{ color: '#f59e0b', fontWeight: '600' }}>
                        ₹{rec.recommendedLimit.toLocaleString('en-IN')}
                      </td>
                      <td>
                        {isOverrun ? (
                          <span className="badge badge-danger" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <AlertCircle size={10} /> Overrun (+₹{Math.round(diff)})
                          </span>
                        ) : rec.currentLimit > 0 && rec.projectedSpent === 0 ? (
                          <span className="badge badge-success">Under limit</span>
                        ) : rec.currentLimit === 0 ? (
                          <span className="badge" style={{ backgroundColor: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', border: '1px solid rgba(245, 158, 11, 0.2)' }}>Recommended</span>
                        ) : (
                          <span className="badge badge-success">Safe</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right: AI Insights */}
        <div className="card card-glowing" style={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-primary)' }}>
            <Sparkles size={18} /> AI Predictive Advisor
          </h3>
          <div 
            style={{ flexGrow: 1, overflowY: 'auto', maxHeight: '300px', fontSize: '13px', lineHeight: '1.6' }}
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(forecast.insights) }}
          />
        </div>

      </div>

    </div>
  );
}
