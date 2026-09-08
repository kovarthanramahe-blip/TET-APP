import React, { useState } from 'react';
import { useSupabaseMigration } from '../hooks/useSupabaseMigration.js';

// Small, non-blocking, dismissible notification for the one-time
// localStorage -> Supabase migration. Renders nothing when there's nothing
// to say (idle, or already migrated on a previous login) so it never nags
// a returning user. The app underneath remains fully usable regardless of
// what this shows -- it never blocks or overlays the rest of the UI.
export default function MigrationBanner() {
  const { status, error, retry } = useSupabaseMigration();
  const [dismissed, setDismissed] = useState(false);

  if (status === 'idle' || status === 'already_migrated' || dismissed) return null;

  const base = {
    position: 'fixed', bottom: 'var(--space-4)', right: 'var(--space-4)', maxWidth: '340px',
    padding: 'var(--space-3) var(--space-4)', borderRadius: 'var(--radius-md)',
    background: 'var(--color-surface)', border: '1px solid var(--color-divider)',
    boxShadow: 'var(--shadow-md)', fontSize: '13px', lineHeight: 1.4,
    display: 'flex', flexDirection: 'column', gap: '8px', zIndex: 1000
  };

  if (status === 'migrating') {
    return (
      <div style={base} role="status">
        <span>Saving your local study data to your account…</span>
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div style={base} role="status">
        <span>Your study data has been saved to your account.</span>
        <button type="button" className="btn btn-ghost" style={{ alignSelf: 'flex-end', fontSize: '12px' }} onClick={() => setDismissed(true)}>
          Dismiss
        </button>
      </div>
    );
  }

  // status === 'error' -- shown clearly and persistently until the user
  // dismisses it or retries; never swallowed silently.
  return (
    <div style={{ ...base, borderColor: '#b3392f' }} role="alert">
      <span style={{ color: '#b3392f' }}>Couldn't save your data to your account: {error}</span>
      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
        <button type="button" className="btn btn-secondary" style={{ fontSize: '12px' }} onClick={() => setDismissed(true)}>
          Dismiss
        </button>
        <button type="button" className="btn btn-primary" style={{ fontSize: '12px' }} onClick={retry}>
          Retry
        </button>
      </div>
    </div>
  );
}
