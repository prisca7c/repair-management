-- ----------------------------------------------------------------------------
-- Run this once in the Supabase SQL editor.
--
-- 1. Adds the `active` column to public.users — staff who've created
--    repairs/quotes/payments can't be hard-deleted (foreign key
--    constraints protect that history), so "removing" a staff member now
--    means deactivating them: they disappear from the "Who are you?"
--    picker and Settings' active list, but their name stays correctly
--    attached to every repair/audit entry they touched.
-- 2. Deactivates Christine specifically, per your request.
--
-- Safe to re-run.
-- ----------------------------------------------------------------------------

alter table public.users add column if not exists active boolean not null default true;

update public.users set active = false where name ilike 'Christine';
