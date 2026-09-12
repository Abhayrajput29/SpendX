import React from 'react';
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
  LogOut
} from 'lucide-react';

export default function Sidebar({ collapsed, user, onSignOut }) {
  const displayName = user?.name || user?.username || 'Abhay';
  const displayEmail = user?.email || 'user@expensewise.local';
  const initials = displayName
    .split(' ')
    .map(n => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase() || 'EW';

  return (
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`} id="sidebar">
      {/* Brand Header */}
      <div className="sidebar-header">
        <NavLink to="/" className="sidebar-brand">
          <span>ExpenseWise</span>
          <span className="badge-ai">AI</span>
        </NavLink>
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav">
        <div className="sidebar-heading">Dashboard</div>
        <ul className="nav-links">
          <li>
            <NavLink to="/" end className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <LayoutDashboard size={18} />
              <span>Overview</span>
            </NavLink>
          </li>
          <li>
            <NavLink to="/transactions" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <Receipt size={18} />
              <span>Expenses</span>
            </NavLink>
          </li>
          <li>
            <NavLink to="/budgets" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <PiggyBank size={18} />
              <span>Monthly Budgets</span>
            </NavLink>
          </li>
          <li>
            <NavLink to="/goals" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <Target size={18} />
              <span>Savings Goals</span>
            </NavLink>
          </li>
          <li>
            <NavLink to="/subscriptions" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <CalendarDays size={18} />
              <span>Subscriptions</span>
            </NavLink>
          </li>
          <li>
            <NavLink to="/forecast" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <TrendingUp size={18} />
              <span>Forecast Expenses</span>
            </NavLink>
          </li>
          <li>
            <NavLink to="/advisor" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <Sparkles size={18} />
              <span>AI Advisor</span>
            </NavLink>
          </li>
          <li>
            <NavLink to="/ocr" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <ScanLine size={18} />
              <span>Receipt Scanner</span>
            </NavLink>
          </li>
        </ul>

        <div className="sidebar-heading">Settings</div>
        <ul className="nav-links">
          <li>
            <NavLink to="/preferences" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <Sliders size={18} />
              <span>General</span>
            </NavLink>
          </li>
          <li>
            <NavLink to="/account" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <User size={18} />
              <span>Account</span>
            </NavLink>
          </li>
        </ul>
      </nav>

      {/* User Footer */}
      <div className="sidebar-footer">
        <div className="user-avatar">{initials}</div>
        <div className="user-info">
          <span className="user-name">{displayName}</span>
          <span className="user-email">{displayEmail}</span>
        </div>
        <button
          className="btn btn-sm btn-outline-danger"
          style={{ padding: '6px 8px', color: '#fff', borderColor: 'rgba(255,255,255,0.3)', background: 'transparent' }}
          onClick={onSignOut}
          title="Sign Out"
        >
          <LogOut size={16} />
        </button>
      </div>
    </aside>
  );
}
