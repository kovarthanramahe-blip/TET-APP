import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth.js';
import { deleteOwnAccount } from '../lib/cloudData.js';

export default function AccountPanel() {
  const { configured, loading, user, notice, signInWithGoogle, sendMagicLink, signOut } = useAuth();
  const [email, setEmail] = useState('');
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const cancelDelete = () => { setConfirmingDelete(false); setConfirmText(''); setDeleteError(''); };

  // Sequenced, not duplicated: after the RPC removes the account (and, via
  // cascade, every row it owns), signOut() is the SAME function the normal
  // "Log out" button already uses -- it already flows through
  // AppContext.jsx's existing logout-cleanup effect (the cross-user
  // localStorage fix from an earlier phase), so no new state-clearing
  // logic is needed here at all.
  //
  // The two awaits are deliberately in separate try/catch blocks, not one
  // combined try around both: a failure in signOut() (a network hiccup,
  // say) happens AFTER the account is already gone server-side, so
  // reporting it as "Could not delete your account" would be a lie the
  // user could act on -- e.g. clicking "Permanently delete" again against
  // an account that no longer exists. Once the account itself is
  // confirmed deleted, a failed local sign-out is handled by reloading
  // instead: that resets every piece of in-memory/client auth state
  // cleanly regardless of what signOut() itself managed to clean up.
  const handleDelete = async () => {
    if (confirmText !== 'DELETE' || deleting) return;
    setDeleting(true);
    setDeleteError('');
    try {
      await deleteOwnAccount();
    } catch (e) {
      setDeleteError(e?.message || 'Could not delete your account.');
      setDeleting(false);
      return;
    }
    try {
      await signOut();
    } catch (e) {
      window.location.reload();
    }
  };

  return (
    <div style={{ borderTop: '1px solid var(--color-divider)', paddingTop: 'var(--space-3)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div style={{ fontSize: '11px', letterSpacing: '.12em', textTransform: 'uppercase', opacity: .65 }}>Account</div>

      {!configured && (
        <p style={{ fontSize: '11px', opacity: .65, margin: 0, lineHeight: 1.4 }}>
          Sign-in isn't configured yet. Add <code>VITE_SUPABASE_URL</code> and{' '}
          <code>VITE_SUPABASE_PUBLISHABLE_KEY</code> to <code>app/.env</code> to enable it.
        </p>
      )}

      {configured && loading && (
        <p style={{ fontSize: '12px', opacity: .65, margin: 0 }}>Checking session…</p>
      )}

      {configured && !loading && user && (
        <>
          <div style={{ fontSize: '13px', overflowWrap: 'anywhere' }}>{user.email}</div>
          <button type="button" className="btn btn-secondary" onClick={signOut}>Log out</button>

          <div style={{ borderTop: '1px solid var(--color-divider)', paddingTop: 'var(--space-2)', marginTop: '4px' }}>
            {!confirmingDelete && (
              <button
                type="button"
                className="btn btn-ghost"
                style={{ fontSize: '11px', color: 'var(--danger-ink)', padding: 0 }}
                onClick={() => setConfirmingDelete(true)}
              >
                Delete my account
              </button>
            )}
            {confirmingDelete && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }} role="alert">
                <p style={{ fontSize: '11px', color: 'var(--danger-ink)', margin: 0, lineHeight: 1.4 }}>
                  This permanently deletes your account and every task, note, session, test attempt, flashcard, and setting stored for it. This cannot be undone.
                </p>
                <input
                  className="input"
                  type="text"
                  aria-label='Type DELETE to confirm account deletion'
                  placeholder='Type "DELETE" to confirm'
                  value={confirmText}
                  onChange={e => setConfirmText(e.target.value)}
                />
                {deleteError && <p style={{ fontSize: '11px', color: 'var(--danger-ink)', margin: 0 }}>{deleteError}</p>}
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button type="button" className="btn btn-secondary" style={{ fontSize: '12px' }} onClick={cancelDelete} disabled={deleting}>
                    Cancel
                  </button>
                  {/* .btn-primary's default text color is --accent-ink (gold/tan,
                      tuned for a neutral background) -- against this button's
                      own solid red fill it read at ~1:1 in light mode, an
                      accidental near-invisible label caught during the Phase
                      25 contrast audit. Explicit white overrides it correctly
                      for this specific solid-fill background. */}
                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{ fontSize: '12px', background: '#b3392f', borderColor: '#b3392f', color: '#fff' }}
                    disabled={confirmText !== 'DELETE' || deleting}
                    onClick={handleDelete}
                  >
                    {deleting ? 'Deleting…' : 'Permanently delete'}
                  </button>
                </div>
              </div>
            )}
          </div>
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
              aria-label="Email address"
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
