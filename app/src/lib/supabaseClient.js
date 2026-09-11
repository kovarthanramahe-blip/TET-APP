// Supabase client for authentication and cloud sync. Study data still lives
// in localStorage by default (dataStore.js) -- Supabase is opt-in on top of
// that.
//
// Phase 26: @supabase/supabase-js is a ~220KB (58KB gzipped) dependency that
// used to be a static import here, which meant every visitor downloaded it
// as part of the app's main entry chunk before first paint -- even when
// isSupabaseConfigured is false (e.g. this sandbox has no app/.env) and the
// package is never actually used. getSupabaseClient() defers the import
// until something actually needs the client (an auth check, a cloud read/
// write), and skips it entirely when Supabase isn't configured. The promise
// is memoized so repeated calls after the first don't re-trigger the import.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// True once both env vars are set (see app/.env.example). Guarding on this
// means the app still runs normally — auth features just stay disabled —
// if Supabase hasn't been configured yet, instead of crashing on load.
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseKey);

let clientPromise = null;

export function getSupabaseClient() {
  if (!isSupabaseConfigured) return Promise.resolve(null);
  if (!clientPromise) {
    clientPromise = import('@supabase/supabase-js').then(({ createClient }) =>
      createClient(supabaseUrl, supabaseKey, { db: { schema: 'public' } })
    );
  }
  return clientPromise;
}
