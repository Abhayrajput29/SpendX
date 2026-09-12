import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Sun, Moon, AlertCircle } from 'lucide-react';

export default function Login({ onLoginSuccess, darkMode, onToggleDark }) {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  function fillDemoCredentials() {
    setIdentifier('admin');
    setPassword('Velmora@2918');
    setError('');
  }

  async function handleSubmit(e) {
    if (e) e.preventDefault();
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
      setError('Unable to connect to server. Please check your network.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-container">
      {/* Top Bar with Brand Logo & Theme Switcher */}
      <header className="auth-top-header">
        <div className="auth-brand">
          <div className="auth-brand-icon">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="12 2 2 7 12 12 22 7 12 2" />
              <polyline points="2 17 12 22 22 17" />
              <polyline points="2 12 12 17 22 12" />
            </svg>
          </div>
          <span className="auth-brand-name">SpendX</span>
        </div>

        {onToggleDark && (
          <button
            type="button"
            className="theme-toggle-btn"
            onClick={onToggleDark}
            title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            aria-label="Toggle theme"
          >
            {darkMode ? <Sun size={18} style={{ color: '#fbbf24' }} /> : <Moon size={18} style={{ color: '#2563eb' }} />}
          </button>
        )}
      </header>

      {/* Centered Modern Card */}
      <main className="auth-card-wrapper">
        <div className="auth-card">
          <div className="auth-header-texts">
            <span className="auth-subtitle">Please enter your details</span>
            <h1 className="auth-title">Welcome back</h1>
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
              <button
                type="button"
                className="auth-forgot-btn"
                onClick={fillDemoCredentials}
                title="Fill admin demo credentials"
              >
                Auto-fill demo
              </button>
            </div>

            <button
              type="submit"
              className="auth-btn-primary"
              disabled={submitting}
            >
              {submitting ? 'Signing in...' : 'Sign in'}
            </button>

            <button
              type="button"
              className="auth-btn-google"
              onClick={fillDemoCredentials}
            >
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
              </svg>
              <span>Sign in with Google</span>
            </button>
          </form>

          <div className="auth-bottom-switch">
            <span>Don't have an account? </span>
            <Link to="/register">Sign up</Link>
          </div>
        </div>
      </main>
    </div>
  );
}
