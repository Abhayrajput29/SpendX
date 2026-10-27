import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Sun, Moon, AlertCircle, ArrowLeft } from 'lucide-react';
import BrandMark from '../components/BrandMark';
import { useAuth } from '../context/AuthContext';

export default function Login({ onLoginSuccess, darkMode, onToggleDark }) {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
  const auth = useAuth();

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
      if (auth?.handleLoginSuccess) {
        auth.handleLoginSuccess(data.token, data.user);
      } else if (onLoginSuccess) {
        onLoginSuccess(data.token, data.user);
      }
      navigate('/dashboard');
    } catch {
      setError('Unable to connect to server. Please check your network.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-container">
      {/* Top Bar with Brand Logo & Theme Switcher */}
      <header className="auth-top-header">
        <Link to="/" className="auth-brand" aria-label="SpendX home">
          <span className="brand-mark">
            <BrandMark />
          </span>
          <div className="auth-brand-text-col">
            <span className="auth-brand-name">SpendX</span>
            <span className="auth-brand-tag">Finance Workspace</span>
          </div>
        </Link>

        <div className="auth-top-actions">
          <Link to="/dashboard" className="auth-back-link">
            <ArrowLeft size={16} />
            <span>Guest Preview</span>
          </Link>
          {onToggleDark && (
            <button
              type="button"
              className="theme-toggle-btn"
              onClick={onToggleDark}
              title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              aria-label="Toggle theme"
            >
              {darkMode ? <Sun size={18} style={{ color: '#fbbf24' }} /> : <Moon size={18} style={{ color: '#60a5fa' }} />}
            </button>
          )}
        </div>
      </header>

      {/* Centered Modern Card matching Dashboard UI */}
      <main className="auth-card-wrapper">
        <div className="auth-card">
          <div className="auth-header-texts">
            <span className="auth-eyebrow">YOUR ACCOUNT</span>
            <h1 className="auth-title">Welcome back</h1>
            <p className="auth-subtitle">Sign in to sync your expenses, budgets, and AI insights.</p>
          </div>

          {error && (
            <div className="auth-error-banner" role="alert">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="auth-form">
            <div className="auth-field">
              <input
                type="text"
                className="auth-input-modern"
                placeholder="Email address or username"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                required
                disabled={submitting}
                autoComplete="username"
              />
            </div>

            <div className="auth-field auth-password-field">
              <input
                type={showPassword ? 'text' : 'password'}
                className="auth-input-modern"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={submitting}
                autoComplete="current-password"
              />
              <button
                type="button"
                className="auth-eye-btn"
                onClick={() => setShowPassword(!showPassword)}
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            <div className="auth-meta-row">
              <label className="auth-remember-label">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                />
                <span>Remember for 30 days</span>
              </label>
            </div>

            <button
              type="submit"
              className="auth-btn-primary"
              disabled={submitting}
            >
              {submitting ? 'Signing in...' : 'Sign in'}
            </button>
          </form>

          <div className="auth-bottom-switch">
            <span>Don't have an account? </span>
            <Link to="/register">Sign up</Link>
          </div>

          <div className="auth-guest-prompt">
            <Link to="/dashboard" className="auth-guest-link">
              Or continue browsing as guest →
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
