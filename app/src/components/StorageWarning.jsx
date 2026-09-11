import React, { useEffect, useState } from 'react';
import { useApp } from '../AppContext.jsx';

// Phase 35: saveState() (see useAppState.js) can fail silently -- browser
// storage quota exceeded, or a browser/mode (e.g. Safari private browsing)
// that restricts localStorage -- and until now nothing told the user their
// edits had stopped being persisted. This is a real risk specifically
// because the app otherwise looks and behaves completely normally while it
// happens: nothing else in the UI would ever reveal it.
//
// Deliberately placed top-right (not bottom-right, where
// MigrationBanner/PwaUpdateBanner already live) so a rare and important
// data-loss warning never gets lost behind, or crowded next to, an
// unrelated sync/update notice.
export default function StorageWarning() {
  const { saveFailed } = useApp();
  const [dismissed, setDismissed] = useState(false);

  // saveFailed is recomputed on every state change (useAppState.js), so
  // storage can recover (a later save succeeds) and then fail again later
  // in the same session -- a genuinely new failure, not a continuation of
  // the one already dismissed. Without this, `dismissed` stayed true
  // forever after the first "Dismiss" click, silently swallowing every
  // subsequent failure for the rest of the session.
  useEffect(() => {
    if (!saveFailed) setDismissed(false);
  }, [saveFailed]);

  if (!saveFailed || dismissed) return null;

  return (
    <div
      role="alert"
      style={{
        position: 'fixed', top: 'var(--space-4)', right: 'var(--space-4)', maxWidth: '340px',
        padding: 'var(--space-3) var(--space-4)', borderRadius: 'var(--radius-md)',
        background: 'var(--color-surface)', border: '1px solid var(--danger-ink)',
        boxShadow: 'var(--shadow-md)', fontSize: '13px', lineHeight: 1.4,
        display: 'flex', flexDirection: 'column', gap: '8px', zIndex: 1000
      }}
    >
      <span style={{ color: 'var(--danger-ink)' }}>
        Your changes aren't being saved on this device — storage might be full or unavailable
        (this can happen in private browsing). Use "Download full backup" in the sidebar now so
        you don't lose today's work.
      </span>
      <button
        type="button"
        className="btn btn-secondary"
        style={{ alignSelf: 'flex-end', fontSize: '12px' }}
        onClick={() => setDismissed(true)}
      >
        Dismiss
      </button>
    </div>
  );
}
