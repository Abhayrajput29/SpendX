import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  User, 
  Lock, 
  Eye, 
  EyeOff, 
  ArrowRight, 
  Sparkles, 
  ShieldCheck, 
  AlertCircle,
  Sun,
  Moon,
  Zap
} from 'lucide-react';

export default function Login({ onLoginSuccess, darkMode, onToggleDark }) {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  function fillDemoCredentials() {
    setIdentifier('admin');
    setPassword('Velmora@2918');
    setError('');
  }

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
        setError(data.error || 'Invalid credentials. Please try again.');
        return;
      }

      localStorage.setItem('spendx_token', data.token);
      if (data.user) {
        localStorage.setItem('spendx_user', JSON.stringify(data.user));
      }
      onLoginSuccess(data.token, data.user);
      navigate('/');
    } catch {
      setError('Unable to connect to server. Please check your internet or backend.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-page">
      {/* Dark / Light Mode Floating Toggle */}
      {onToggleDark && (
        <button
          type="button"
          className="theme-toggle-btn auth-theme-toggle"
          onClick={onToggleDark}
          title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          aria-label="Toggle theme"
        >
          {darkMode ? <Sun size={18} style={{ color: '#fbbf24' }} /> : <Moon size={18} style={{ color: '#6366f1' }} />}
        </button>
      )}

      {/* Brand Header */}
      <div className="auth-header">
        <div className="auth-logo-badge">
          <Sparkles size={26} />
        </div>
        <div className="auth-brand-title">
          SpendX <span className="badge-ai">AI</span>
        </div>
        <div className="auth-brand-subtitle">
          Next-generation intelligent expense & wealth tracker
        </div>
      </div>

      {/* Main Authentication Card */}
      <div className="auth-card">
        {/* Navigation Tabs */}
        <div className="auth-nav-tabs">
          <Link to="/login" className="auth-nav-tab active">
            Sign In
          </Link>
          <Link to="/register" className="auth-nav-tab">
            Create Account
          </Link>
        </div>

        {error && (
          <div className="auth-alert-error" role="alert">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="auth-input-group">
            <label htmlFor="auth-identifier">Username or Email</label>
            <div className="auth-input-wrapper">
              <span className="auth-input-icon">
                <User size={18} />
              </span>
              <input
                id="auth-identifier"
                type="text"
                placeholder="e.g. admin or yourname@domain.com"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                required
                disabled={submitting}
                autoComplete="username"
              />
            </div>
          </div>

          <div className="auth-input-group">
            <label htmlFor="auth-password">Password</label>
            <div className="auth-input-wrapper">
              <span className="auth-input-icon">
                <Lock size={18} />
              </span>
              <input
                id="auth-password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={submitting}
                autoComplete="current-password"
              />
              <button
                type="button"
                className="auth-password-toggle"
                onClick={() => setShowPassword(!showPassword)}
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="auth-submit-btn"
            disabled={submitting}
          >
            <span>{submitting ? 'Signing in...' : 'Sign In to SpendX'}</span>
            <ArrowRight size={17} />
          </button>
        </form>

        {/* Quick Demo Helper */}
        <div className="auth-demo-box">
          <div className="auth-demo-text">
            <span>Demo: <strong>admin</strong> / <strong>Velmora@2918</strong></span>
          </div>
          <button
            type="button"
            className="auth-demo-btn"
            onClick={fillDemoCredentials}
          >
            Auto-fill
          </button>
        </div>

        <div className="auth-footer">
          Don't have an account yet?{' '}
          <Link to="/register">Create one for free</Link>
        </div>
      </div>

      {/* Trust & Features chips */}
      <div className="auth-features-chips">
        <div className="auth-feature-chip">
          <ShieldCheck size={14} style={{ color: 'var(--color-success)' }} />
          <span>256-bit SSL Security</span>
        </div>
        <span>•</span>
        <div className="auth-feature-chip">
          <Zap size={14} style={{ color: 'var(--color-warning)' }} />
          <span>Instant OCR & AI</span>
        </div>
      </div>
    </div>
  );
}
