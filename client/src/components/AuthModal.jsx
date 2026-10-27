import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import BrandMark from './BrandMark';
import { Eye, EyeOff, AlertCircle, CheckCircle2, X, Sparkles } from 'lucide-react';

export default function AuthModal() {
  const {
    authModalOpen,
    authModalMode,
    authModalReason,
    closeAuthModal,
    setAuthModalMode,
    handleLoginSuccess
  } = useAuth();

  // Login form state
  const [identifier, setIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  // Register form state
  const [regUsername, setRegUsername] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(true);

  // Status state
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!authModalOpen) return null;

  async function handleLogin(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: identifier, password: loginPassword })
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
      handleLoginSuccess(data.token, data.user);
    } catch {
      setError('Unable to connect to server. Please check your network.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRegister(e) {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (regUsername.trim().length < 3) {
      setError('Username must be at least 3 characters');
      return;
    }

    if (regPassword.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: regUsername.trim(),
          email: regEmail.trim(),
          password: regPassword
        })
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
          handleLoginSuccess(data.token, data.user);
        }, 700);
      } else {
        setTimeout(() => {
          setAuthModalMode('login');
          setSuccess('');
        }, 1000);
      }
    } catch {
      setError('Unable to reach server. Please check your network connection.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-modal-backdrop" onClick={closeAuthModal} role="dialog" aria-modal="true">
      <div className="auth-modal-card" onClick={(e) => e.stopPropagation()}>
        {/* Close Button */}
        <button
          type="button"
          className="auth-modal-close"
          onClick={closeAuthModal}
          aria-label="Close modal"
        >
          <X size={18} />
        </button>

        {/* Brand Header */}
        <div className="auth-modal-header">
          <div className="auth-brand">
            <span className="brand-mark">
              <BrandMark />
            </span>
            <div className="auth-brand-text-col">
              <span className="auth-brand-name">SpendX</span>
              <span className="auth-brand-tag">Finance Workspace</span>
            </div>
          </div>
        </div>

        {/* Feature Lock Notice if triggered by a user action */}
        {authModalReason && (
          <div className="auth-modal-reason-banner">
            <Sparkles size={15} className="auth-reason-icon" />
            <div className="auth-reason-text">
              <span className="auth-reason-title">Sign in required</span>
              <span className="auth-reason-desc">{authModalReason}</span>
            </div>
          </div>
        )}

        {/* Tab Switcher */}
        <div className="auth-modal-tabs">
          <button
            type="button"
            className={`auth-modal-tab ${authModalMode === 'login' ? 'active' : ''}`}
            onClick={() => {
              setAuthModalMode('login');
              setError('');
              setSuccess('');
            }}
          >
            Sign in
          </button>
          <button
            type="button"
            className={`auth-modal-tab ${authModalMode === 'register' ? 'active' : ''}`}
            onClick={() => {
              setAuthModalMode('register');
              setError('');
              setSuccess('');
            }}
          >
            Create account
          </button>
        </div>

        {/* Feedback Banners */}
        {error && (
          <div className="auth-error-banner" role="alert">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="auth-success-banner" role="alert">
            <CheckCircle2 size={16} />
            <span>{success}</span>
          </div>
        )}

        {/* Sign In Form */}
        {authModalMode === 'login' && (
          <form onSubmit={handleLogin} className="auth-form">
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
                autoFocus
              />
            </div>

            <div className="auth-field auth-password-field">
              <input
                type={showLoginPassword ? 'text' : 'password'}
                className="auth-input-modern"
                placeholder="Password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                required
                disabled={submitting}
                autoComplete="current-password"
              />
              <button
                type="button"
                className="auth-eye-btn"
                onClick={() => setShowLoginPassword(!showLoginPassword)}
                title={showLoginPassword ? 'Hide password' : 'Show password'}
              >
                {showLoginPassword ? <EyeOff size={18} /> : <Eye size={18} />}
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
        )}

        {/* Register Form */}
        {authModalMode === 'register' && (
          <form onSubmit={handleRegister} className="auth-form">
            <div className="auth-field">
              <input
                type="text"
                className="auth-input-modern"
                placeholder="Username"
                value={regUsername}
                onChange={(e) => setRegUsername(e.target.value)}
                required
                disabled={submitting}
                autoComplete="username"
                autoFocus
              />
            </div>

            <div className="auth-field">
              <input
                type="email"
                className="auth-input-modern"
                placeholder="Email address"
                value={regEmail}
                onChange={(e) => setRegEmail(e.target.value)}
                required
                disabled={submitting}
                autoComplete="email"
              />
            </div>

            <div className="auth-field auth-password-field">
              <input
                type={showRegPassword ? 'text' : 'password'}
                className="auth-input-modern"
                placeholder="Password (minimum 6 characters)"
                value={regPassword}
                onChange={(e) => setRegPassword(e.target.value)}
                required
                disabled={submitting}
                autoComplete="new-password"
              />
              <button
                type="button"
                className="auth-eye-btn"
                onClick={() => setShowRegPassword(!showRegPassword)}
                title={showRegPassword ? 'Hide password' : 'Show password'}
              >
                {showRegPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            <div className="auth-meta-row">
              <label className="auth-remember-label">
                <input
                  type="checkbox"
                  checked={agreeTerms}
                  onChange={(e) => setAgreeTerms(e.target.checked)}
                />
                <span>Agree to Terms & Privacy Policy</span>
              </label>
            </div>

            <button
              type="submit"
              className="auth-btn-primary"
              disabled={submitting}
            >
              {submitting ? 'Creating account...' : 'Create account'}
            </button>
          </form>
        )}

        {/* Guest fallback button */}
        <div className="auth-modal-footer">
          <button
            type="button"
            className="auth-guest-btn"
            onClick={closeAuthModal}
          >
            Continue exploring in Guest Mode
          </button>
        </div>
      </div>
    </div>
  );
}
