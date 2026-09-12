import React from 'react';
import { Menu, LogOut, User, Sun, Moon } from 'lucide-react';

export default function Navbar({ onToggleSidebar, user, onSignOut, darkMode, onToggleDark }) {
  const username = user?.username || 'User';

  return (
    <header className="topbar">
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <button
          type="button"
          className="topbar-toggle-btn"
          id="sidebarCollapse"
          onClick={onToggleSidebar}
          title="Toggle Navigation"
        >
          <Menu size={20} />
        </button>
        <div>
          <h1 style={{ fontSize: '17px', fontWeight: 600, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.2px', transition: 'color var(--t-smooth)' }}>
            SpendX Dashboard
          </h1>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)', transition: 'color var(--t-smooth)' }}>
            Welcome back, <strong style={{ color: 'var(--color-primary)' }}>{username}</strong>
          </span>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        {/* Dark mode toggle */}
        <button
          type="button"
          className="theme-toggle-btn"
          onClick={onToggleDark}
          title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          aria-label="Toggle dark mode"
        >
          {darkMode
            ? <Sun size={17} style={{ color: '#fbbf24' }} />
            : <Moon size={17} style={{ color: '#6366f1' }} />
          }
        </button>

        {/* User pill */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          padding: '6px 12px',
          background: 'var(--bg-muted)',
          borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--border-color)',
          transition: 'background var(--t-smooth), border-color var(--t-smooth)',
        }}>
          <User size={15} color="var(--color-primary)" />
          <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)', transition: 'color var(--t-smooth)' }}>
            {username}
          </span>
        </div>

        <button
          type="button"
          className="btn btn-outline-danger btn-sm"
          style={{ padding: '7px 14px', fontSize: '13px' }}
          onClick={onSignOut}
        >
          <LogOut size={14} />
          <span>Sign Out</span>
        </button>
      </div>
    </header>
  );
}
