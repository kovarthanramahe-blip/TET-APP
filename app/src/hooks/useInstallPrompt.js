import { useCallback, useEffect, useState } from 'react';

// Phase 31: captures the browser's `beforeinstallprompt` event
// (Chrome/Edge/Android -- Safari and Firefox never fire it, so canInstall
// simply stays false there, same as before the browser decides install
// criteria are met, or once the app is already installed) so an in-app
// action can trigger it on demand instead of installability being
// discoverable only through the browser's own buried menu.
export function useInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);

  useEffect(() => {
    function handleBeforeInstallPrompt(e) {
      // Stops the browser's own automatic mini-infobar so the app controls
      // exactly when and how the user is asked, and stores the event for
      // promptInstall() below -- it can only be prompted from within the
      // same handler's event, which is why it has to be captured here.
      e.preventDefault();
      setDeferredPrompt(e);
    }
    function handleAppInstalled() {
      // Fires on a successful install regardless of how it was triggered
      // (this prompt, or the browser's own UI) -- clearing here too covers
      // that second path, not just the one inside promptInstall().
      setDeferredPrompt(null);
    }
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    // A captured beforeinstallprompt event can only ever be prompted once
    // -- clear it after the user's choice comes back, whether they
    // accepted or dismissed, so a spent event can never be prompted again
    // (the action simply disappears until the browser fires a new one).
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
  }, [deferredPrompt]);

  return { canInstall: !!deferredPrompt, promptInstall };
}
