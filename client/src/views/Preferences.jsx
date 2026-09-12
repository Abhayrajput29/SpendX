import React from 'react';
import { Moon, Sun, Monitor } from 'lucide-react';

export default function Preferences({ darkMode, onToggleDark }) {

  return (
    <div>
      <div className="view-header">
        <div className="view-title-container">
          <h1 className="view-title">General Preferences</h1>
          <p className="view-subtitle">Customise your SpendX experience.</p>
        </div>
      </div>

      {/* Appearance */}
      <div className="card" style={{ maxWidth: '520px' }}>
        <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '18px', color: 'var(--text-primary)' }}>
          Appearance
        </h3>

        <div style={{ display: 'flex', gap: '12px' }}>
          {/* Light */}
          <button
            type="button"
            onClick={() => darkMode && onToggleDark()}
            style={{
              flex: 1, padding: '14px 12px',
              borderRadius: 'var(--radius-md)',
              border: `2px solid ${!darkMode ? 'var(--color-primary)' : 'var(--border-color)'}`,
              background: !darkMode ? 'var(--color-primary-dim)' : 'var(--bg-muted)',
              cursor: 'pointer', display: 'flex', flexDirection: 'column',
              alignItems: 'center', gap: '8px',
              transition: 'all var(--t-normal)',
            }}
          >
            <Sun size={22} color={!darkMode ? 'var(--color-primary)' : 'var(--text-muted)'} />
            <span style={{ fontSize: '13px', fontWeight: 600, color: !darkMode ? 'var(--color-primary)' : 'var(--text-secondary)' }}>
              Light
            </span>
          </button>

          {/* Dark */}
          <button
            type="button"
            onClick={() => !darkMode && onToggleDark()}
            style={{
              flex: 1, padding: '14px 12px',
              borderRadius: 'var(--radius-md)',
              border: `2px solid ${darkMode ? 'var(--color-primary)' : 'var(--border-color)'}`,
              background: darkMode ? 'var(--color-primary-dim)' : 'var(--bg-muted)',
              cursor: 'pointer', display: 'flex', flexDirection: 'column',
              alignItems: 'center', gap: '8px',
              transition: 'all var(--t-normal)',
            }}
          >
            <Moon size={22} color={darkMode ? 'var(--color-primary)' : 'var(--text-muted)'} />
            <span style={{ fontSize: '13px', fontWeight: 600, color: darkMode ? 'var(--color-primary)' : 'var(--text-secondary)' }}>
              Dark
            </span>
          </button>

          {/* System */}
          <button
            type="button"
            onClick={() => {
              const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
              if (prefersDark !== darkMode) onToggleDark();
            }}
            style={{
              flex: 1, padding: '14px 12px',
              borderRadius: 'var(--radius-md)',
              border: '2px solid var(--border-color)',
              background: 'var(--bg-muted)',
              cursor: 'pointer', display: 'flex', flexDirection: 'column',
              alignItems: 'center', gap: '8px',
              transition: 'all var(--t-normal)',
            }}
          >
            <Monitor size={22} color="var(--text-muted)" />
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>
              System
            </span>
          </button>
        </div>

        <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', marginTop: '12px' }}>
          Theme preference is saved locally in your browser.
        </p>
      </div>

      {/* Currency info */}
      <div className="card" style={{ maxWidth: '520px' }}>
        <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '12px', color: 'var(--text-primary)' }}>
          Currency
        </h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 18px', background: 'var(--bg-muted)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
          <span style={{ fontSize: '28px', lineHeight: 1 }}>₹</span>
          <div>
            <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-primary)' }}>Indian Rupee (INR)</div>
            <div style={{ fontSize: '12.5px', color: 'var(--text-muted)', marginTop: '2px' }}>All amounts are displayed in ₹</div>
          </div>
        </div>
      </div>
    </div>
  );
}
