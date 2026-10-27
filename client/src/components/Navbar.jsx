import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Menu, Search, Sun, Moon, Sparkles, UserPlus, LogIn } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const quickLinks = [
  { label: 'Overview', to: '/dashboard', end: true },
  { label: 'Expenses', to: '/transactions' },
  { label: 'Budgets', to: '/budgets' },
  { label: 'Goals', to: '/goals' },
];

export default function Navbar({ onToggleSidebar, sidebarExpanded, darkMode, onToggleDark }) {
  const [search, setSearch] = useState('');
  const navigate = useNavigate();
  const { user, isAuthenticated, openAuthModal, requireAuth } = useAuth();

  const username = user?.name || user?.username || 'Account';
  const initials = username
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase() || 'U';

  function handleSearch(event) {
    event.preventDefault();
    const query = search.trim();
    if (!query) return;

    requireAuth(() => {
      navigate(`/transactions?search=${encodeURIComponent(query)}`);
    }, 'Sign in to search and filter your transactions');
  }

  function handleAiClick(e) {
    if (!isAuthenticated) {
      e.preventDefault();
      requireAuth(() => {
        navigate('/advisor');
      }, 'Sign in to ask the SpendX AI Advisor for portfolio analysis');
    }
  }

  return (
    <header className="topbar">
      <div className="topbar-leading">
        <button
          type="button"
          className="topbar-toggle-btn"
          onClick={onToggleSidebar}
          title={sidebarExpanded ? 'Collapse navigation' : 'Expand navigation'}
          aria-label={sidebarExpanded ? 'Collapse navigation' : 'Expand navigation'}
          aria-controls="sidebar"
          aria-expanded={sidebarExpanded}
        >
          <Menu size={20} aria-hidden="true" />
        </button>

        <form className="topbar-search" role="search" onSubmit={handleSearch}>
          <Search size={18} aria-hidden="true" />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search transactions"
            aria-label="Search transactions"
          />
          <button type="submit" className="search-submit" aria-label="Open matching transactions">
            ↵
          </button>
        </form>
      </div>

      <nav className="topbar-tabs" aria-label="Quick navigation">
        {quickLinks.map(({ label, to, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) => `topbar-tab ${isActive ? 'active' : ''}`}
          >
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="topbar-actions">
        <NavLink to="/advisor" className="topbar-ai-link" onClick={handleAiClick}>
          <Sparkles size={16} aria-hidden="true" />
          <span>Ask AI</span>
        </NavLink>

        <button
          type="button"
          className="theme-toggle-btn"
          onClick={onToggleDark}
          title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
          aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {darkMode ? <Sun size={18} aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />}
        </button>

        {isAuthenticated ? (
          <NavLink to="/account" className="topbar-account-link" title={username}>
            <div className="topbar-account">
              <span className="topbar-avatar" aria-hidden="true">{initials}</span>
              <span className="topbar-account-name">{username}</span>
            </div>
          </NavLink>
        ) : (
          <div className="topbar-auth-group">
            <button
              type="button"
              className="topbar-auth-btn topbar-auth-btn-signin"
              onClick={() => openAuthModal('login', 'Sign in to access your transactions, budgets, and savings goals')}
            >
              <LogIn size={15} />
              <span>Sign in</span>
            </button>
            <button
              type="button"
              className="topbar-auth-btn topbar-auth-btn-signup"
              onClick={() => openAuthModal('register', 'Create your free account to start tracking finances')}
            >
              <UserPlus size={15} />
              <span>Sign up</span>
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
