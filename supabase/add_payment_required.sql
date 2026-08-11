-- ============================================================================
-- One-off migration: adds "payment required before work starts" support.
-- Run this once in the Supabase SQL editor on the live project (schema.sql
-- already has these columns for any fresh install, but that file is not
-- re-run against a database that already exists).
-- ============================================================================

alter table public.repairs
  add column if not exists payment_required_type text not null default 'none';

do $$ begin
  alter table public.repairs
    add constraint repairs_payment_required_type_check
    check (payment_required_type in ('none', 'deposit', 'full'));
exception when duplicate_object then null; end $$;

alter table public.repairs
  add column if not exists deposit_amount numeric(10,2);

alter table public.quote_approvals
  add column if not exists payment_confirmed boolean not null default false;

alter table public.quote_approvals
  add column if not exists payment_confirmed_at timestamptz;
