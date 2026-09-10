import { useCallback, useEffect, useState } from 'react';
import { getSupabaseClient, isSupabaseConfigured } from '../lib/supabaseClient.js';

// Authentication only. Independent of useAppState.js — study data stays in
// localStorage untouched; this hook just tracks who (if anyone) is signed in.
export function useAuth() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let active = true;
    let unsubscribe = () => {};

    getSupabaseClient().then(supabase => {
      if (!active) return;
      supabase.auth.getSession().then(({ data }) => {
        if (active) {
          setSession(data.session);
          setLoading(false);
        }
      });

      const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
        setSession(newSession);
      });
      unsubscribe = () => listener.subscription.unsubscribe();
      // The effect may have been torn down while the import above was still
      // in flight -- subscribing after that would leak the listener forever
      // since the cleanup below already ran and can't call this unsubscribe.
      if (!active) unsubscribe();
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const signInWithGoogle = useCallback(async () => {
    if (!isSupabaseConfigured) return;
    setNotice('');
    const supabase = await getSupabaseClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin }
    });
    if (error) setNotice(error.message);
  }, []);

  const sendMagicLink = useCallback(async (email) => {
    if (!isSupabaseConfigured || !email) return;
    setNotice('Sending link…');
    const supabase = await getSupabaseClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin }
    });
    setNotice(error ? error.message : 'Check your email for the sign-in link.');
  }, []);

  const signOut = useCallback(async () => {
    if (!isSupabaseConfigured) return;
    setNotice('');
    const supabase = await getSupabaseClient();
    await supabase.auth.signOut();
  }, []);

  return {
    configured: isSupabaseConfigured,
    loading,
    user: session?.user ?? null,
    notice,
    signInWithGoogle,
    sendMagicLink,
    signOut
  };
}
