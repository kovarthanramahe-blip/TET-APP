import React, { useState } from 'react';
import { useApp } from '../AppContext.jsx';
import { exportBackupJSON, parseBackupFile, MAX_BACKUP_FILE_BYTES } from '../lib/exportData.js';
import { seedState } from '../lib/logic.js';

// Restoring a backup replaces base.state wholesale via update() -- for a
// signed-in (cloud-active) user, the cloud hooks in AppContext.jsx would
// just resync tasks/notes/sessions/confidence/attempts/customCards from
// Supabase right back over it on the next tick, silently undoing the
// restore for exactly the fields that matter most. Restore is therefore
// only offered when not cloud-active; a signed-in user's data already has
// a durable home in their account, which is the gap this feature exists to
// cover for local-only users in the first place. Export has no such
// problem -- it just reads whatever `state` already is (cloud-merged or
// not) -- so it stays available either way.
export default function BackupPanel() {
  const { state, update, migration } = useApp();
  const cloudActive = (migration.status === 'success' || migration.status === 'already_migrated') && !!migration.userId;

  const [confirming, setConfirming] = useState(false);
  const [pendingState, setPendingState] = useState(null);
  const [error, setError] = useState('');
  const [restored, setRestored] = useState(false);

  const handleFile = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    setError('');
    setRestored(false);
    // Reject an oversized file by its reported size before ever reading it
    // into memory -- cheaper than letting parseBackupFile's own length
    // check catch it only after the full contents have been loaded.
    if (file.size > MAX_BACKUP_FILE_BYTES) {
      setError('That backup file is too large.');
      return;
    }
    const text = await file.text();
    const result = parseBackupFile(text);
    if (result.error) { setError(result.error); return; }
    setPendingState(result.state);
    setConfirming(true);
  };

  const confirmRestore = () => {
    // Spread, not Object.assign: pendingState is already a validated,
    // allowlisted-keys-only object from parseBackupFile(), but spread is
    // used here too as defense in depth -- unlike Object.assign, it copies
    // properties by value (CreateDataProperty) rather than through [[Set]],
    // so it can never be tricked into reassigning the target's prototype
    // even if that validation were ever loosened later.
    update(() => ({ ...seedState(), ...pendingState }));
    setConfirming(false);
    setPendingState(null);
    setRestored(true);
  };

  const cancelRestore = () => { setConfirming(false); setPendingState(null); };

  return (
    <div style={{ borderTop: '1px solid var(--color-divider)', paddingTop: 'var(--space-3)' }}>
      <div style={{ fontSize: '11px', letterSpacing: '.12em', textTransform: 'uppercase', opacity: .65, marginBottom: '6px' }}>
        Backup &amp; restore
      </div>

      <button
        type="button"
        className="btn btn-secondary"
        style={{ fontSize: '12px', padding: '5px 9px', width: '100%' }}
        onClick={() => exportBackupJSON(state)}
      >
        Download full backup
      </button>

      {cloudActive && (
        <p style={{ fontSize: '11px', opacity: .65, margin: 'var(--space-2) 0 0', lineHeight: 1.4 }}>
          Your data already lives in your account. Restoring a backup file is only available when you're not signed in.
        </p>
      )}

      {!cloudActive && !confirming && (
        <label
          className="btn btn-secondary"
          style={{ fontSize: '12px', padding: '5px 9px', width: '100%', marginTop: '6px', display: 'block', textAlign: 'center', cursor: 'pointer' }}
        >
          Restore from backup
          {/* Visually hidden, not display:none -- display:none removes an
              element from the tab order entirely, making this whole control
              unreachable by keyboard even though the wrapping <label> looks
              clickable. This keeps the native input focusable/operable
              (Enter/Space opens the file picker) while staying invisible. */}
          <input
            type="file" accept="application/json" onChange={handleFile}
            style={{ position: 'absolute', width: '1px', height: '1px', padding: 0, margin: '-1px', overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap', border: 0 }}
          />
        </label>
      )}

      {confirming && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '6px' }} role="alert">
          <p style={{ fontSize: '11px', color: 'var(--danger-ink)', margin: 0, lineHeight: 1.4 }}>
            This replaces everything currently on this device — sessions, tasks, notes, confidence marks, flashcards, and settings — with the contents of the backup file. This cannot be undone.
          </p>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button type="button" className="btn btn-secondary" style={{ fontSize: '12px' }} onClick={cancelRestore}>
              Cancel
            </button>
            {/* Explicit white text: see the matching comment in
                AccountPanel.jsx's "Permanently delete" button -- same
                .btn-primary-default-color-on-solid-red-fill issue. */}
            <button
              type="button"
              className="btn btn-primary"
              style={{ fontSize: '12px', background: '#b3392f', borderColor: '#b3392f', color: '#fff' }}
              onClick={confirmRestore}
            >
              Replace my data
            </button>
          </div>
        </div>
      )}

      {error && <p role="alert" style={{ fontSize: '11px', color: 'var(--danger-ink)', margin: 'var(--space-2) 0 0' }}>{error}</p>}
      {restored && <p role="status" style={{ fontSize: '11px', opacity: .7, margin: 'var(--space-2) 0 0' }}>Backup restored.</p>}
    </div>
  );
}
