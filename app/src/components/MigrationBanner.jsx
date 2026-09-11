import React, { useEffect, useState } from 'react';
import { useApp } from '../AppContext.jsx';

// Small, non-blocking, dismissible notification for the one-time
// localStorage -> Supabase migration, plus (once migrated) any error from
// the cloud tasks/notes sync layer. Renders nothing when there's nothing to
// say so it never nags a returning user. The app underneath remains fully
// usable regardless of what this shows -- it never blocks or overlays the
// rest of the UI.
//
// Reads migration state from AppContext rather than calling
// useSupabaseMigration() itself: AppContext calls that hook exactly once
// (see the comment there) so that migration is only ever attempted from a
// single place. If this component called the hook directly too, it would
// create a second independent instance that could race the first.
export default function MigrationBanner() {
  const { migration } = useApp();
  const { status, error, retry, cloudError, clearCloudError } = migration;
  const [dismissed, setDismissed] = useState(false);

  // MigrationBanner is rendered persistently (Shell never unmounts it, even
  // across a logout/login) and `dismissed` never reset on its own -- so
  // dismissing an error banner permanently silenced every LATER migration
  // attempt too, including the one useSupabaseMigration.js's own comment
  // documents as the intended manual retry path: "log out, log back in".
  // Re-arming at the start of every fresh attempt (status flips to
  // 'migrating' on both an automatic re-login attempt and a manual Retry
  // click) means a dismissal only ever silences the attempt it was shown
  // for, never attempts that haven't happened yet.
  useEffect(() => {
    if (status === 'migrating') setDismissed(false);
  }, [status]);

  const base = {
    position: 'fixed', right: 'var(--space-4)', maxWidth: '340px',
    padding: 'var(--space-3) var(--space-4)', borderRadius: 'var(--radius-md)',
    background: 'var(--color-surface)', border: '1px solid var(--color-divider)',
    boxShadow: 'var(--shadow-md)', fontSize: '13px', lineHeight: 1.4,
    display: 'flex', flexDirection: 'column', gap: '8px', zIndex: 1000
  };

  const showMigration = !(status === 'idle' || status === 'already_migrated' || dismissed);
  const showCloudError = !!cloudError;

  let migrationBanner = null;
  if (showMigration) {
    const bottom = 'var(--space-4)';
    if (status === 'migrating') {
      migrationBanner = (
        <div style={{ ...base, bottom }} role="status">
          <span>Saving your local study data to your account…</span>
        </div>
      );
    } else if (status === 'success') {
      migrationBanner = (
        <div style={{ ...base, bottom }} role="status">
          <span>Your study data has been saved to your account.</span>
          <button type="button" className="btn btn-ghost" style={{ alignSelf: 'flex-end', fontSize: '12px' }} onClick={() => setDismissed(true)}>
            Dismiss
          </button>
        </div>
      );
    } else {
      // status === 'error' -- shown clearly and persistently until the user
      // dismisses it or retries; never swallowed silently.
      migrationBanner = (
        <div style={{ ...base, bottom, borderColor: 'var(--danger-ink)' }} role="alert">
          <span style={{ color: 'var(--danger-ink)' }}>Couldn't save your data to your account: {error}</span>
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
  }

  // Stack above the migration banner when both are visible, otherwise sit
  // in its own spot at the bottom.
  const cloudErrorBottom = showMigration ? 'calc(var(--space-4) + 76px)' : 'var(--space-4)';
  const cloudErrorBanner = showCloudError ? (
    <div style={{ ...base, bottom: cloudErrorBottom, borderColor: 'var(--danger-ink)' }} role="alert">
      <span style={{ color: 'var(--danger-ink)' }}>Couldn't sync with your account: {cloudError}</span>
      <button type="button" className="btn btn-secondary" style={{ alignSelf: 'flex-end', fontSize: '12px' }} onClick={clearCloudError}>
        Dismiss
      </button>
    </div>
  ) : null;

  if (!migrationBanner && !cloudErrorBanner) return null;

  return (
    <>
      {migrationBanner}
      {cloudErrorBanner}
    </>
  );
}
