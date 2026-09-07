// Supabase client for authentication. Study data (sessions, tasks, notes,
// etc.) still lives entirely in localStorage via dataStore.js — this file
// is only wired up for sign-in/sign-out at this stage.
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// True once both env vars are set (see app/.env.example). Guarding on this
// means the app still runs normally — auth features just stay disabled —
// if Supabase hasn't been configured yet, instead of crashing on load.
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseKey)
  : null;
