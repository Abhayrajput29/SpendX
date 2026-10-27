import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Receipt,
  PiggyBank,
  Target,
  CalendarDays,
  TrendingUp,
  Sparkles,
  ScanLine,
  Sliders,
  User,
  LogOut,
  LogIn,
} from 'lucide-react';
import BrandMark from './BrandMark';
import { useAuth } from '../context/AuthContext';

const navigationGroups = [
  {
    title: 'Workspace',
    items: [
      { label: 'Overview', to: '/dashboard', icon: LayoutDashboard, end: true },
      { label: 'Transactions', to: '/transactions', icon: Receipt },
      { label: 'Budgets', to: '/budgets', icon: PiggyBank },
      { label: 'Savings goals', to: '/goals', icon: Target },
      { label: 'Subscriptions', to: '/subscriptions', icon: CalendarDays },
    ],
  },
  {
    title: 'Insights',
    items: [
      { label: 'Forecast', to: '/forecast', icon: TrendingUp },
      { label: 'AI advisor', to: '/advisor', icon: Sparkles },
      { label: 'Receipt scanner', to: '/ocr', icon: ScanLine },
    ],
  },
  {
    title: 'Settings',
    items: [
      { label: 'Preferences', to: '/preferences', icon: Sliders },
      { label: 'Account', to: '/account', icon: User },
    ],
  },
];

export default function Sidebar({ collapsed, onNavigate }) {
  const { user, isAuthenticated, logout, openAuthModal } = useAuth();

  const displayName = user?.name || user?.username || 'My account';
  const displayEmail = user?.email || 'Personal workspace';
  const initials = displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase() || 'U';

  return (
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`} id="sidebar" aria-label="Main navigation">
      <div className="sidebar-header">
        <NavLink to="/" className="sidebar-brand" onClick={onNavigate} aria-label="SpendX home">
          <span className="brand-mark">
            <BrandMark />
          </span>
          <span className="brand-name">SpendX</span>
        </NavLink>
      </div>

      <nav className="sidebar-nav">
        {navigationGroups.map((group) => (
          <section className="sidebar-section" key={group.title} aria-label={group.title}>
            <h2 className="sidebar-heading">{group.title}</h2>
            <ul className="nav-links">
              {group.items.map(({ label, to, icon: Icon, end }) => (
                <li key={to}>
                  <NavLink
                    to={to}
                    end={end}
                    title={label}
                    aria-label={label}
                    onClick={onNavigate}
                    className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                  >
                    <Icon size={20} strokeWidth={1.8} aria-hidden="true" />
                    <span className="nav-label">{label}</span>
                  </NavLink>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </nav>

      <div className="sidebar-footer">
        {isAuthenticated ? (
          <>
            <div className="user-avatar" aria-hidden="true">{initials}</div>
            <div className="user-info">
              <span className="user-name">{displayName}</span>
              <span className="user-email">{displayEmail}</span>
            </div>
            <button
              type="button"
              className="sidebar-signout"
              onClick={logout}
              title="Sign out"
              aria-label="Sign out"
            >
              <LogOut size={18} aria-hidden="true" />
            </button>
          </>
        ) : (
          <>
            <div
              className="user-avatar guest-avatar"
              aria-hidden="true"
              onClick={() => openAuthModal('login', 'Sign in to access your personal finance workspace')}
              title="Guest Mode — Click to Sign In"
            >
              <User size={18} />
            </div>
            <div className="user-info">
              <span className="user-name">Guest Mode</span>
              <span className="user-email">Sign in to sync</span>
            </div>
            <button
              type="button"
              className="sidebar-signin-btn"
              onClick={() => openAuthModal('login', 'Sign in to access your personal finance workspace')}
              title="Sign in"
              aria-label="Sign in"
            >
              <LogIn size={18} aria-hidden="true" />
            </button>
          </>
        )}
      </div>
    </aside>
  );
}
