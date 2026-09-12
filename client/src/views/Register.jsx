import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  User, 
  Mail, 
  Lock, 
  Eye, 
  EyeOff, 
  ArrowRight, 
  Sparkles, 
  ShieldCheck, 
  AlertCircle,
  CheckCircle2,
  Sun,
  Moon,
  Zap
} from 'lucide-react';

export default function Register({ onLoginSuccess, darkMode, onToggleDark }) {
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

    if (username.trim().length < 3) {
      setError('Username must be at least 3 characters');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), email: email.trim(), password })
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Registration failed. Please try a different username.');
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
      setError('Unable to reach server. Please check your internet or backend connection.');
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
          Start your journey to financial freedom today
        </div>
      </div>

      {/* Main Authentication Card */}
      <div className="auth-card">
        {/* Navigation Tabs */}
        <div className="auth-nav-tabs">
          <Link to="/login" className="auth-nav-tab">
            Sign In
          </Link>
          <Link to="/register" className="auth-nav-tab active">
            Create Account
          </Link>
        </div>

        {error && (
          <div className="auth-alert-error" role="alert">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="auth-alert-success" role="alert">
            <CheckCircle2 size={16} />
            <span>{success}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="auth-input-group">
            <label htmlFor="reg-username">Username</label>
            <div className="auth-input-wrapper">
              <span className="auth-input-icon">
                <User size={18} />
              </span>
              <input
                id="reg-username"
                type="text"
                placeholder="Choose a unique username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                disabled={submitting}
                autoComplete="username"
              />
            </div>
          </div>

          <div className="auth-input-group">
            <label htmlFor="reg-email">Email Address</label>
            <div className="auth-input-wrapper">
              <span className="auth-input-icon">
                <Mail size={18} />
              </span>
              <input
                id="reg-email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={submitting}
                autoComplete="email"
              />
            </div>
          </div>

          <div className="auth-input-group">
            <label htmlFor="reg-password">Password</label>
            <div className="auth-input-wrapper">
              <span className="auth-input-icon">
                <Lock size={18} />
              </span>
              <input
                id="reg-password"
                type={showPassword ? 'text' : 'password'}
                placeholder="At least 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={submitting}
                autoComplete="new-password"
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
            <span>{submitting ? 'Creating Account...' : 'Create SpendX Account'}</span>
            <ArrowRight size={17} />
          </button>
        </form>

        <div className="auth-footer">
          Already have an account?{' '}
          <Link to="/login">Sign in here</Link>
        </div>
      </div>

      {/* Trust & Features chips */}
      <div className="auth-features-chips">
        <div className="auth-feature-chip">
          <ShieldCheck size={14} style={{ color: 'var(--color-success)' }} />
          <span>Encrypted Data</span>
        </div>
        <span>•</span>
        <div className="auth-feature-chip">
          <Zap size={14} style={{ color: 'var(--color-warning)' }} />
          <span>100% Free Forever</span>
        </div>
      </div>
    </div>
  );
}
