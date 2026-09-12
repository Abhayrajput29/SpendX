import React from 'react';

export default function Account({ user, onSignOut }) {
  return (
    <div className="content-body">
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Account Profile</h2>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '450px' }}>
          <div>
            <label style={{ fontSize: '13px', fontWeight: 600, color: '#718096' }}>Username</label>
            <p style={{ fontSize: '16px', fontWeight: 500, marginTop: '4px' }}>{user?.username || 'User'}</p>
          </div>

          <div>
            <label style={{ fontSize: '13px', fontWeight: 600, color: '#718096' }}>Email Address</label>
            <p style={{ fontSize: '16px', fontWeight: 500, marginTop: '4px' }}>{user?.email || 'user@expensewise.local'}</p>
          </div>

          <div>
            <label style={{ fontSize: '13px', fontWeight: 600, color: '#718096' }}>Account Status</label>
            <p style={{ fontSize: '14px', color: '#10b981', fontWeight: 600, marginTop: '4px' }}>● Active</p>
          </div>

          <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: '1px solid #e2e8f0' }}>
            <button type="button" className="btn btn-danger" onClick={onSignOut}>
              Sign Out from Account
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
