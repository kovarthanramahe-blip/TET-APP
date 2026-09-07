-- ============================================================================
-- HTET Preparation — flashcards uniqueness follow-up
-- Adds a UNIQUE constraint on flashcards(front) so the Phase 3C seed (and
-- any future re-seed) can safely use ON CONFLICT DO NOTHING. Without this,
-- flashcards had no natural key to de-duplicate against, unlike every other
-- reference table in the Phase 3B schema.
--
-- Does NOT modify the Phase 3B migrations. Adds one constraint only — no
-- data changes, no RLS changes, no other tables affected.
-- ============================================================================

alter table public.flashcards
  add constraint flashcards_front_key unique (front);
