import { lazy, Suspense, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

import Sidebar from './components/Sidebar';
import Navbar from './components/Navbar';
import AuthModal from './components/AuthModal';
import { AuthProvider } from './context/AuthContext';

let themeSwitchFrame = 0;

function applyTheme(darkMode) {
  const root = document.documentElement;
  if (themeSwitchFrame) cancelAnimationFrame(themeSwitchFrame);
  root.classList.add('theme-switching');
  if (darkMode) {
    root.setAttribute('data-theme', 'dark');
  } else {
    root.removeAttribute('data-theme');
  }
  localStorage.setItem('spendx_theme', darkMode ? 'dark' : 'light');

  themeSwitchFrame = requestAnimationFrame(() => {
    themeSwitchFrame = requestAnimationFrame(() => {
      root.classList.remove('theme-switching');
      themeSwitchFrame = 0;
    });
  });
}

const Login = lazy(() => import('./views/Login'));
const Register = lazy(() => import('./views/Register'));
const LandingPage = lazy(() => import('./views/LandingPage'));
const Dashboard = lazy(() => import('./views/Dashboard'));
const OcrScanner = lazy(() => import('./views/OcrScanner'));
const Transactions = lazy(() => import('./views/Transactions'));
const Budgets = lazy(() => import('./views/Budgets'));
const Goals = lazy(() => import('./views/Goals'));
const AiAdvisor = lazy(() => import('./views/AiAdvisor'));
const Forecast = lazy(() => import('./views/Forecast'));
const Subscriptions = lazy(() => import('./views/Subscriptions'));
const Preferences = lazy(() => import('./views/Preferences'));
const Account = lazy(() => import('./views/Account'));

function AppContent({ darkMode, toggleDarkMode }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);

  return (
    <div className="app-container">
      <Sidebar
        collapsed={sidebarCollapsed}
        onNavigate={() => setSidebarCollapsed(true)}
      />
      {!sidebarCollapsed && (
        <button
          type="button"
          className="sidebar-backdrop"
          aria-label="Close navigation"
          onClick={() => setSidebarCollapsed(true)}
        />
      )}

      <main className="main-content">
        <Navbar
          onToggleSidebar={() => setSidebarCollapsed(prev => !prev)}
          sidebarExpanded={!sidebarCollapsed}
          darkMode={darkMode}
          onToggleDark={toggleDarkMode}
        />

        <div className="content-body">
          <Suspense fallback={<div className="route-loading">Loading overview…</div>}>
            <Routes>
              <Route path="/dashboard"     element={<Dashboard darkMode={darkMode} />} />
              <Route path="/transactions"  element={<Transactions />} />
              <Route path="/budgets"       element={<Budgets />} />
              <Route path="/goals"         element={<Goals />} />
              <Route path="/subscriptions" element={<Subscriptions />} />
              <Route path="/forecast"      element={<Forecast darkMode={darkMode} />} />
              <Route path="/advisor"       element={<AiAdvisor />} />
              <Route path="/ocr"           element={<OcrScanner />} />
              <Route path="/preferences"   element={<Preferences darkMode={darkMode} onToggleDark={toggleDarkMode} />} />
              <Route path="/account"       element={<Account />} />
              <Route path="*"              element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </Suspense>
        </div>
      </main>

      {/* Global Auth Modal for prompting guests to sign in or create an account */}
      <AuthModal />
    </div>
  );
}

export default function App() {
  // ── Dark Mode ──────────────────────────────────────────────
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('spendx_theme');
    const initialDarkMode = saved
      ? saved === 'dark'
      : window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
    applyTheme(initialDarkMode);
    return initialDarkMode;
  });

  function toggleDarkMode() {
    const nextDarkMode = !darkMode;
    applyTheme(nextDarkMode);
    setDarkMode(nextDarkMode);
  }

  return (
    <BrowserRouter>
      <AuthProvider>
        <Suspense fallback={<div className="route-loading">Loading…</div>}>
          <Routes>
            <Route
              path="/"
              element={<LandingPage darkMode={darkMode} onToggleDark={toggleDarkMode} />}
            />
            {/* Dedicated full page routes for direct navigation to /login or /register */}
            <Route
              path="/login"
              element={<Login darkMode={darkMode} onToggleDark={toggleDarkMode} />}
            />
            <Route
              path="/register"
              element={<Register darkMode={darkMode} onToggleDark={toggleDarkMode} />}
            />

            {/* Main Application (accessible to everyone, including guests in preview mode) */}
            <Route
              path="/*"
              element={<AppContent darkMode={darkMode} toggleDarkMode={toggleDarkMode} />}
            />
          </Routes>
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
  );
}
