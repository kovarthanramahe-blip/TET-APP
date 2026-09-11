-- ============================================================================
-- Phase 15: self-service account deletion
--
-- The anon/publishable key the browser client uses can never delete an
-- auth.users row directly -- only the service role key can, and that must
-- never reach the browser. The standard, secure Supabase pattern for
-- "let a signed-in user delete their own account" is a SECURITY DEFINER
-- Postgres function: it runs with the privileges of the role that created
-- it (which has the necessary rights on the auth schema), but is gated to
-- only ever delete auth.uid()'s OWN row -- a caller can never pass another
-- user's id, because the id isn't a parameter at all.
--
-- Deleting the auth.users row cascades to every table referencing it --
-- profiles, tasks, notes, study_sessions, topic_confidence,
-- flashcard_srs_state, quiz_attempts, quiz_attempt_answers, and
-- custom_flashcards -- all of which already use
-- "references auth.users(id) on delete cascade". This single statement is
-- therefore sufficient to remove all of a user's data; no per-table
-- deletes are needed here.
-- ============================================================================

create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from auth.users where id = auth.uid();
end;
$$;

-- Callable only by a signed-in user, and only ever against their own row
-- (there is no id parameter to pass someone else's).
revoke all on function public.delete_own_account() from public;
grant execute on function public.delete_own_account() to authenticated;
