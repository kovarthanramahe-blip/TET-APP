import React from 'react';
import { useInstallPrompt } from '../hooks/useInstallPrompt.js';

// Phase 31: renders nothing until the browser actually signals the app is
// installable (see useInstallPrompt.js), and nothing again once it's
// installed or the captured prompt's one-time use is spent -- so this
// slots into the sidebar the same way ExportPanel/BackupPanel do, without
// ever showing a dead or misleading action.
export default function InstallPrompt() {
  const { canInstall, promptInstall } = useInstallPrompt();
  if (!canInstall) return null;

  return (
    <button type="button" className="btn btn-secondary btn-block" onClick={promptInstall}>
      Install app
    </button>
  );
}
