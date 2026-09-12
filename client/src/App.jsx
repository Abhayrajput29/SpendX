import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

import Sidebar from './components/Sidebar';
import Navbar from './components/Navbar';

import Login from './views/Login';
import Register from './views/Register';
import Dashboard from './views/Dashboard';
import OcrScanner from './views/OcrScanner';
import Transactions from './views/Transactions';
import Budgets from './views/Budgets';
import Goals from './views/Goals';
import AiAdvisor from './views/AiAdvisor';
import Forecast from './views/Forecast';
import Subscriptions from './views/Subscriptions';
import Preferences from './views/Preferences';
import Account from './views/Account';

export default function App() {
  const [token, setToken] = useState(() => localStorage.getItem('spendx_token'));
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem('spendx_user');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // ── Dark Mode ──────────────────────────────────────────────
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('spendx_theme');
    if (saved) return saved === 'dark';
    // Respect OS preference on first visit
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
  });

  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) {
      root.setAttribute('data-theme', 'dark');
      localStorage.setItem('spendx_theme', 'dark');
    } else {
      root.removeAttribute('data-theme');
      localStorage.setItem('spendx_theme', 'light');
    }
  }, [darkMode]);

  function toggleDarkMode() {
    setDarkMode(prev => !prev);
  }

  // ── Session ────────────────────────────────────────────────
  useEffect(() => {
    const handleExpiredSession = () => {
      setToken(null);
      setUser(null);
      localStorage.removeItem('spendx_token');
      localStorage.removeItem('spendx_user');
    };
    window.addEventListener('spendx:session-expired', handleExpiredSession);
    return () => window.removeEventListener('spendx:session-expired', handleExpiredSession);
  }, []);

  // Fetch current user if token exists but user info is missing
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

  function handleLoginSuccess(newToken, newUser) {
    setToken(newToken);
    if (newUser) setUser(newUser);
  }

  function handleSignOut() {
    localStorage.removeItem('spendx_token');
    localStorage.removeItem('spendx_user');
    setToken(null);
    setUser(null);
  }

  return (
    <BrowserRouter>
      {!token ? (
        <Routes>
          <Route path="/login"    element={<Login    onLoginSuccess={handleLoginSuccess} darkMode={darkMode} onToggleDark={toggleDarkMode} />} />
          <Route path="/register" element={<Register onLoginSuccess={handleLoginSuccess} darkMode={darkMode} onToggleDark={toggleDarkMode} />} />
          <Route path="*"         element={<Navigate to="/login" replace />} />
        </Routes>
      ) : (
        <div className="app-container">
          <Sidebar
            collapsed={sidebarCollapsed}
            user={user}
            onSignOut={handleSignOut}
          />

          <main className="main-content">
            <Navbar
              onToggleSidebar={() => setSidebarCollapsed(prev => !prev)}
              user={user}
              onSignOut={handleSignOut}
              darkMode={darkMode}
              onToggleDark={toggleDarkMode}
            />

            <div className="content-body">
              <Routes>
                <Route path="/"              element={<Dashboard     user={user} />} />
                <Route path="/transactions"  element={<Transactions  user={user} />} />
                <Route path="/budgets"       element={<Budgets       user={user} />} />
                <Route path="/goals"         element={<Goals         user={user} />} />
                <Route path="/subscriptions" element={<Subscriptions user={user} />} />
                <Route path="/forecast"      element={<Forecast      user={user} />} />
                <Route path="/advisor"       element={<AiAdvisor     user={user} />} />
                <Route path="/ocr"           element={<OcrScanner    user={user} />} />
                <Route path="/preferences"   element={<Preferences   user={user} darkMode={darkMode} onToggleDark={toggleDarkMode} />} />
                <Route path="/account"       element={<Account       user={user} onSignOut={handleSignOut} />} />
                <Route path="*"              element={<Navigate to="/" replace />} />
              </Routes>
            </div>
          </main>
        </div>
      )}
    </BrowserRouter>
  );
}
