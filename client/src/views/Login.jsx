import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

export default function Login({ onLoginSuccess }) {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: identifier, password })
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Invalid credentials, try again');
        return;
      }

      localStorage.setItem('spendx_token', data.token);
      if (data.user) {
        localStorage.setItem('spendx_user', JSON.stringify(data.user));
      }
      onLoginSuccess(data.token, data.user);
      navigate('/');
    } catch {
      setError('Unable to connect to server. Please check your backend.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-wrapper">
      {/* Left Sidebar Preview mimicking ExpenseWise */}
      <aside className="auth-sidebar-preview">
        <div className="brand">ExpenseWise</div>
        
        <div className="menu-label">DASHBOARD</div>
        <div className="menu-item">Expenses</div>
        <div className="menu-item">Income</div>
        <div className="menu-item">Forecast Expenses</div>

        <div className="menu-label">SUMMARY</div>
        <div className="menu-item">Expense Summary</div>
        <div className="menu-item">Income summary</div>
        <div className="menu-item">Reports</div>
        <div className="menu-item">Goals</div>

        <div className="menu-label">SETTINGS</div>
        <div className="menu-item">General</div>
        <div className="menu-item">Account</div>
      </aside>

      {/* Main Form Area */}
      <div className="auth-main">
        <div className="auth-top-nav">
          <Link to="/login" className="active" style={{ color: '#866ec7', fontWeight: 600 }}>Login</Link>
          <Link to="/register">Register</Link>
        </div>

        <div className="auth-card-container">
          <div className="auth-card">
            <h2>Login to your account</h2>

            {error && (
              <div className="auth-alert-danger" role="alert">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div className="auth-input-group">
                <input
                  type="text"
                  className="auth-input"
                  placeholder="Username or Email"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  required
                  disabled={submitting}
                  autoComplete="username"
                />
              </div>

              <div className="auth-input-group password-wrapper">
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="auth-input"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={submitting}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? 'HIDE' : 'SHOW'}
                </button>
              </div>

              <button
                type="submit"
                className="auth-submit-btn"
                disabled={submitting}
              >
                {submitting ? 'Signing in...' : 'Login'}
              </button>
            </form>

            <div className="auth-footer-text">
              Don't have an account? <Link to="/register">Register here</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
