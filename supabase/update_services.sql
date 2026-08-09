-- ----------------------------------------------------------------------------
-- Run this once in the Supabase SQL editor to bring an already-live database
-- up to date: adds the sort_order column, and replaces the old default
-- service list with the exact official list/order/pricing.
--
-- Safe to re-run — every step is idempotent.
-- ----------------------------------------------------------------------------

alter table public.services add column if not exists sort_order integer not null default 100;

-- Rename/update the old defaults in place where they match by name, so any
-- existing quote_version_items still referencing them via service_id keep
-- pointing at the same row.
update public.services set name = 'Re-string', description = 'Full set of new strings fitted (shop strings)', price = 25.00, sort_order = 1
  where name = 'Restring';
update public.services set description = 'Deep clean plus a full restring', price = 35.00, sort_order = 3
  where name = 'Deep clean + restring';
update public.services set name = 'Minimum bench', description = 'Minimum charge for small bench repairs', price = 35.00, sort_order = 5
  where name = 'Minimum bench charge / small repair';
update public.services set description = 'Basic setup (strings not included) — starting from', price = 70.00, sort_order = 4
  where name = 'Basic setup';

-- Add the new "re-string with chosen strings" option if it's not there yet.
insert into public.services (name, description, price, active, sort_order)
select 'Re-string with chosen strings', 'Customer supplies/chooses the strings — price is on top of string cost', 25.00, true, 2
where not exists (select 1 from public.services where name = 'Re-string with chosen strings');

-- Anything else (e.g. the old "Cleaning" default, or any of your own custom
-- services) just falls to the back of the list (sort_order default 100) and
-- keeps showing up — nothing is deleted.
