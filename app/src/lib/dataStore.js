// Thin persistence layer. This is the ONLY module in the app allowed to
// touch `localStorage` directly — everything else (business logic, React
// state) goes through the functions below. Keeping raw storage access in
// one place means swapping localStorage for a real backend later only
// requires changing this file.

const APP_STORAGE_KEY = 'htet-prep-v1';

// Read and parse the app's saved state. Returns null if nothing is saved,
// or if storage is unavailable/corrupt — callers fall back to defaults.
export function readStoredState() {
  try {
    const raw = localStorage.getItem(APP_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

// Persist a plain, JSON-serialisable state object. Fails silently if
// storage is unavailable (private browsing, quota exceeded, etc.) so a
// storage error never crashes the app.
export function writeStoredState(state) {
  try {
    localStorage.setItem(APP_STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch (e) {
    return false;
  }
}

// Remove all saved app state.
export function clearStoredState() {
  try {
    localStorage.removeItem(APP_STORAGE_KEY);
    return true;
  } catch (e) {
    return false;
  }
}

export const STORAGE_KEY = APP_STORAGE_KEY;
