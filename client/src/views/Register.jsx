import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

export default function Register({ onLoginSuccess }) {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (username.length < 3) {
      setError('Username must be at least 3 characters');
      return;
    }

    if (password.length < 6) {
      setError('Password too short (must be at least 6 characters)');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password })
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Registration failed');
        return;
      }

      setSuccess('Account created successfully! Logging you in...');
      if (data.token) {
        localStorage.setItem('spendx_token', data.token);
        if (data.user) {
          localStorage.setItem('spendx_user', JSON.stringify(data.user));
        }
        setTimeout(() => {
          onLoginSuccess(data.token, data.user);
          navigate('/');
        }, 800);
      } else {
        setTimeout(() => navigate('/login'), 1200);
      }
    } catch {
      setError('Unable to reach server. Please ensure the backend is running.');
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
          <Link to="/login">Login</Link>
          <Link to="/register" className="active" style={{ color: '#866ec7', fontWeight: 600 }}>Register</Link>
        </div>

        <div className="auth-card-container">
          <div className="auth-card">
            <h2>Register for an account</h2>

            {error && (
              <div className="auth-alert-danger" role="alert">
                {error}
              </div>
            )}

            {success && (
              <div className="auth-alert-success" role="alert">
                {success}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div className="auth-input-group">
                <input
                  type="text"
                  className="auth-input"
                  placeholder="Username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  disabled={submitting}
                  autoComplete="username"
                />
              </div>

              <div className="auth-input-group">
                <input
                  type="email"
                  className="auth-input"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={submitting}
                  autoComplete="email"
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
                  autoComplete="new-password"
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
                {submitting ? 'Registering...' : 'Register'}
              </button>
            </form>

            <div className="auth-footer-text">
              Already have an account? <Link to="/login">Login here</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
