import { useAuth } from '../context/AuthContext';
import { User, LogIn, UserPlus, ShieldCheck } from 'lucide-react';

export default function Account() {
  const { user, isAuthenticated, logout, openAuthModal } = useAuth();

  return (
    <div className="content-body" style={{ padding: '0' }}>
      <div className="view-header" style={{ marginBottom: '20px' }}>
        <div className="view-title-container">
          <h1 className="view-title">Account Profile</h1>
          <p className="view-subtitle">Manage your personal workspace authentication and credentials.</p>
        </div>
      </div>

      <div className="card" style={{ maxWidth: '540px' }}>
        {isAuthenticated ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '8px' }}>
              <div
                style={{
                  width: '54px',
                  height: '54px',
                  borderRadius: '50%',
                  background: 'var(--color-primary)',
                  color: '#15190e',
                  display: 'grid',
                  placeItems: 'center',
                  fontSize: '20px',
                  fontWeight: 750
                }}
              >
                {(user?.name || user?.username || 'U')[0].toUpperCase()}
              </div>
              <div>
                <h3 style={{ margin: '0 0 4px', fontSize: '18px', fontWeight: 700 }}>
                  {user?.name || user?.username || 'Account Owner'}
                </h3>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  Personal Workspace Member
                </span>
              </div>
            </div>

            <div>
              <label style={{ fontSize: '12px', fontWeight: 650, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Username</label>
              <p style={{ fontSize: '15px', fontWeight: 550, marginTop: '4px', color: 'var(--text-primary)' }}>{user?.username || 'user'}</p>
            </div>

            <div>
              <label style={{ fontSize: '12px', fontWeight: 650, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Email Address</label>
              <p style={{ fontSize: '15px', fontWeight: 550, marginTop: '4px', color: 'var(--text-primary)' }}>{user?.email || 'user@spendx.local'}</p>
            </div>

            <div>
              <label style={{ fontSize: '12px', fontWeight: 650, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Account Status</label>
              <p style={{ fontSize: '13.5px', color: 'var(--color-success)', fontWeight: 650, marginTop: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <ShieldCheck size={16} /> Authenticated & Active
              </p>
            </div>

            <div style={{ marginTop: '16px', paddingTop: '18px', borderTop: '1px solid var(--border-color)' }}>
              <button type="button" className="btn btn-outline-danger" onClick={logout}>
                Sign Out from Workspace
              </button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', textAlign: 'center', padding: '16px 8px' }}>
            <div
              style={{
                width: '56px',
                height: '56px',
                borderRadius: '50%',
                background: 'var(--bg-muted)',
                color: 'var(--text-muted)',
                display: 'grid',
                placeItems: 'center',
                margin: '0 auto 4px'
              }}
            >
              <User size={28} />
            </div>

            <h3 style={{ margin: '0', fontSize: '19px', fontWeight: 700 }}>Guest Explorer Mode</h3>
            <p style={{ margin: '0', fontSize: '13.5px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              You are currently viewing SpendX in guest preview mode without persistent session data. Sign in or create an account to unlock full personal tracking.
            </p>

            <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', marginTop: '10px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => openAuthModal('login', 'Sign in to access your saved profile')}
                style={{ padding: '9px 18px' }}
              >
                <LogIn size={16} /> Sign In
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => openAuthModal('register', 'Create an account to start tracking personal expenses')}
                style={{ padding: '9px 20px' }}
              >
                <UserPlus size={16} /> Create Free Account
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
