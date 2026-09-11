import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

// useAuth.js reads isSupabaseConfigured/getSupabaseClient from
// supabaseClient.js -- mocked wholesale here (rather than mocking
// @supabase/supabase-js itself) so isSupabaseConfigured can be forced true
// regardless of this sandbox having no app/.env, and so the fake client's
// auth methods are fully controllable per test.
const signOut = vi.fn();
const getSession = vi.fn();
const onAuthStateChange = vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } }));

vi.mock('../lib/supabaseClient.js', () => ({
  isSupabaseConfigured: true,
  getSupabaseClient: () => Promise.resolve({
    auth: { getSession, onAuthStateChange, signOut }
  })
}));

const { useAuth } = await import('./useAuth.js');

beforeEach(() => {
  signOut.mockReset();
  getSession.mockReset().mockResolvedValue({ data: { session: { user: { id: 'u1', email: 'a@b.com' } } } });
  onAuthStateChange.mockClear();
});

// supabase-js's signOut() resolves with { error } on an ordinary failure
// (an expired/invalid session, a rejected server response) rather than
// rejecting -- only a raw exception (e.g. total network failure) used to
// reject. useAuth.js's signOut() previously discarded that { error }
// entirely, so a caller's try/catch (AccountPanel.jsx's account-deletion
// flow specifically catches a signOut() failure to fall back to a full
// page reload) never ran for the common failure shape.
describe('useAuth: signOut() surfaces a Supabase-reported failure', () => {
  it('throws when supabase.auth.signOut() resolves with an error', async () => {
    signOut.mockResolvedValue({ error: { message: 'session already revoked' } });
    const { result } = renderHook(() => useAuth());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await expect(result.current.signOut()).rejects.toThrow('session already revoked');
  });

  it('resolves cleanly when supabase.auth.signOut() succeeds', async () => {
    signOut.mockResolvedValue({ error: null });
    const { result } = renderHook(() => useAuth());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await expect(result.current.signOut()).resolves.toBeUndefined();
  });
});
