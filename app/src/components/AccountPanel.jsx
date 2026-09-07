import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth.js';

export default function AccountPanel() {
  const { configured, loading, user, notice, signInWithGoogle, sendMagicLink, signOut } = useAuth();
  const [email, setEmail] = useState('');

  return (
    <div style={{ borderTop: '1px solid var(--color-divider)', paddingTop: 'var(--space-3)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div style={{ fontSize: '11px', letterSpacing: '.12em', textTransform: 'uppercase', opacity: .6 }}>Account</div>

      {!configured && (
        <p style={{ fontSize: '11px', opacity: .6, margin: 0, lineHeight: 1.4 }}>
          Sign-in isn't configured yet. Add <code>VITE_SUPABASE_URL</code> and{' '}
          <code>VITE_SUPABASE_PUBLISHABLE_KEY</code> to <code>app/.env</code> to enable it.
        </p>
      )}

      {configured && loading && (
        <p style={{ fontSize: '12px', opacity: .6, margin: 0 }}>Checking session…</p>
      )}

      {configured && !loading && user && (
        <>
          <div style={{ fontSize: '13px', overflowWrap: 'anywhere' }}>{user.email}</div>
          <button type="button" className="btn btn-secondary" onClick={signOut}>Log out</button>
        </>
      )}

      {configured && !loading && !user && (
        <>
          <button type="button" className="btn btn-secondary" onClick={signInWithGoogle}>
            Continue with Google
          </button>
          <div className="field" style={{ margin: 0 }}>
            <input
              className="input"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
          </div>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => sendMagicLink(email)}
            disabled={!email}
          >
            Send magic link
          </button>
          {notice && <p style={{ fontSize: '11px', opacity: .7, margin: 0 }}>{notice}</p>}
        </>
      )}
    </div>
  );
}
