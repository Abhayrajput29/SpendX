import { createContext, useContext, useState, useEffect, useCallback } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('spendx_token'));
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem('spendx_user');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  // Modal State
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState('login'); // 'login' | 'register'
  const [authModalReason, setAuthModalReason] = useState('');
  const [pendingAction, setPendingAction] = useState(null);

  // Synchronize on expired session
  useEffect(() => {
    const handleExpired = () => {
      setToken(null);
      setUser(null);
      localStorage.removeItem('spendx_token');
      localStorage.removeItem('spendx_user');
    };
    window.addEventListener('spendx:session-expired', handleExpired);
    return () => window.removeEventListener('spendx:session-expired', handleExpired);
  }, []);

  // Fetch /api/auth/me if token exists but user info missing
  useEffect(() => {
    if (token && !user) {
      fetch('/api/auth/me')
        .then(res => res.ok ? res.json() : Promise.reject())
        .then(data => {
          if (data.user) {
            setUser(data.user);
            localStorage.setItem('spendx_user', JSON.stringify(data.user));
          }
        })
        .catch(() => {});
    }
  }, [token, user]);

  const openAuthModal = useCallback((mode = 'login', reason = '', onActionSuccess = null) => {
    setAuthModalMode(mode);
    setAuthModalReason(reason);
    setPendingAction(() => onActionSuccess);
    setAuthModalOpen(true);
  }, []);

  const closeAuthModal = useCallback(() => {
    setAuthModalOpen(false);
    setAuthModalReason('');
    setPendingAction(null);
  }, []);

  const handleLoginSuccess = useCallback((newToken, newUser) => {
    setToken(newToken);
    if (newUser) setUser(newUser);
    setAuthModalOpen(false);
    setAuthModalReason('');
    if (pendingAction && typeof pendingAction === 'function') {
      try {
        pendingAction();
      } catch (err) {
        console.error('Pending action execution error:', err);
      }
      setPendingAction(null);
    }
  }, [pendingAction]);

  const logout = useCallback(() => {
    localStorage.removeItem('spendx_token');
    localStorage.removeItem('spendx_user');
    setToken(null);
    setUser(null);
  }, []);

  /**
   * Helper to guard any action. If authenticated, executes immediately.
   * If not authenticated, opens the Auth modal with an informative message.
   */
  const requireAuth = useCallback((actionFn, reason = 'Sign in to access this feature') => {
    if (token) {
      if (typeof actionFn === 'function') actionFn();
      return true;
    }
    openAuthModal('login', reason, actionFn);
    return false;
  }, [token, openAuthModal]);

  const isAuthenticated = Boolean(token);

  return (
    <AuthContext.Provider
      value={{
        token,
        user,
        isAuthenticated,
        authModalOpen,
        authModalMode,
        authModalReason,
        openAuthModal,
        closeAuthModal,
        setAuthModalMode,
        handleLoginSuccess,
        logout,
        requireAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
