-- ============================================================================
-- Repair Shop MVP — schema.sql
-- Run this in the Supabase SQL editor (or via `supabase db push`) on a fresh
-- project. Safe to re-run is NOT guaranteed — this is an initial-setup script.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- ENUM TYPES
-- ----------------------------------------------------------------------------
do $$ begin
  create type user_role as enum ('admin', 'staff');
exception when duplicate_object then null; end $$;

do $$ begin
  create type instrument_type as enum ('guitar', 'bass', 'ukulele', 'violin', 'other');
exception when duplicate_object then null; end $$;

do $$ begin
  create type repair_status as enum ('received', 'working', 'waiting', 'ready', 'collected');
exception when duplicate_object then null; end $$;

do $$ begin
  create type waiting_reason as enum ('customer', 'parts', 'technician', 'other');
exception when duplicate_object then null; end $$;

do $$ begin
  create type location_type as enum ('repair_room', 'home_staff', 'home_technician', 'other');
exception when duplicate_object then null; end $$;

do $$ begin
  create type approval_response as enum ('pending', 'approved', 'declined');
exception when duplicate_object then null; end $$;

do $$ begin
  create type payment_method as enum ('cash', 'card');
exception when duplicate_object then null; end $$;

-- ----------------------------------------------------------------------------
-- USERS (staff picker only — no login, no passwords, no Supabase Auth link.
-- This app runs on a single shared shop computer; a "user" here just exists
-- so actions can be attributed in the audit log. Add/remove staff by
-- inserting/deleting rows directly.)
-- ----------------------------------------------------------------------------
create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  name text not null,
  role user_role not null default 'staff',
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- CUSTOMERS
-- ----------------------------------------------------------------------------
create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  last_name text not null,
  email text,
  phone text,
  notes text,
  marketing_consent boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists customers_name_idx on public.customers (lower(first_name || ' ' || last_name));
create index if not exists customers_email_idx on public.customers (lower(email));
create index if not exists customers_phone_idx on public.customers (phone);

-- ----------------------------------------------------------------------------
-- TECHNICIANS
-- ----------------------------------------------------------------------------
create table if not exists public.technicians (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text,
  phone text,
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- SERVICES (catalogue)
-- ----------------------------------------------------------------------------
create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  price numeric(10,2) not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- REPAIR NUMBER SEQUENCES — one counter row per calendar year, used by
-- lib/repairNumber.ts (via an atomic upsert) to format R-{year}-{4 digit seq}
-- ----------------------------------------------------------------------------
create table if not exists public.repair_number_counters (
  year int primary key,
  last_seq int not null default 0
);

-- ----------------------------------------------------------------------------
-- REPAIRS
-- ----------------------------------------------------------------------------
create table if not exists public.repairs (
  id uuid primary key default gen_random_uuid(),
  repair_number text not null unique,
  customer_id uuid not null references public.customers(id),
  instrument_type instrument_type not null default 'guitar',
  instrument_description text,
  brand text,
  model text,
  serial_number text,
  photo_url text,
  work_description text,
  quote_total numeric(10,2) not null default 0,
  status repair_status not null default 'received',
  waiting_reason waiting_reason,
  location_type location_type not null default 'repair_room',
  location_text text,
  location_staff_id uuid references public.users(id),
  technician_required boolean not null default false,
  technician_id uuid references public.technicians(id),
  technician_pay numeric(10,2),
  technician_paid boolean not null default false,
  technician_paid_at timestamptz,
  job_done boolean not null default false,
  customer_paid boolean not null default false,
  verbally_discussed boolean not null default false,
  notes text,
  received_at timestamptz not null default now(),
  ready_at timestamptz,
  collected_at timestamptz,
  created_by uuid references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

create index if not exists repairs_status_idx on public.repairs (status);
create index if not exists repairs_customer_idx on public.repairs (customer_id);
create index if not exists repairs_archived_idx on public.repairs (archived_at);
create index if not exists repairs_search_idx on public.repairs (lower(repair_number));

-- ----------------------------------------------------------------------------
-- REPAIR ITEMS (current/live price breakdown shown on the repair)
-- ----------------------------------------------------------------------------
create table if not exists public.repair_items (
  id uuid primary key default gen_random_uuid(),
  repair_id uuid not null references public.repairs(id) on delete cascade,
  service_id uuid references public.services(id),
  description text not null,
  quantity numeric(10,2) not null default 1,
  unit_price numeric(10,2) not null default 0,
  line_total numeric(10,2) not null default 0,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- QUOTE VERSIONS — immutable history. New quote = new row, never edit old ones.
-- ----------------------------------------------------------------------------
create table if not exists public.quote_versions (
  id uuid primary key default gen_random_uuid(),
  repair_id uuid not null references public.repairs(id) on delete cascade,
  version_number int not null,
  work_description text,
  total numeric(10,2) not null default 0,
  created_by uuid references public.users(id),
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  unique (repair_id, version_number)
);

create table if not exists public.quote_version_items (
  id uuid primary key default gen_random_uuid(),
  quote_version_id uuid not null references public.quote_versions(id) on delete cascade,
  description text not null,
  quantity numeric(10,2) not null default 1,
  unit_price numeric(10,2) not null default 0,
  line_total numeric(10,2) not null default 0
);

-- ----------------------------------------------------------------------------
-- QUOTE APPROVALS — one row per quote_version that was sent for approval.
-- Public tokens are NEVER stored raw — only sha256 hash + expiry.
-- ----------------------------------------------------------------------------
create table if not exists public.quote_approvals (
  id uuid primary key default gen_random_uuid(),
  quote_version_id uuid not null references public.quote_versions(id) on delete cascade,
  repair_id uuid not null references public.repairs(id) on delete cascade,
  token_hash text not null unique,
  token_expires_at timestamptz not null,
  response approval_response not null default 'pending',
  customer_message text,
  responded_at timestamptz,
  cancelled_by_staff boolean not null default false,
  cancelled_by_user_id uuid references public.users(id),
  cancelled_at timestamptz,
  cancellation_reason text,
  created_at timestamptz not null default now()
);

create index if not exists quote_approvals_repair_idx on public.quote_approvals (repair_id);
create index if not exists quote_approvals_token_hash_idx on public.quote_approvals (token_hash);

-- ----------------------------------------------------------------------------
-- COMMUNICATIONS — log of every email attempted (success or failure)
-- ----------------------------------------------------------------------------
create table if not exists public.communications (
  id uuid primary key default gen_random_uuid(),
  repair_id uuid not null references public.repairs(id) on delete cascade,
  type text not null, -- approval | confirmation | update | ready | cancellation | internal_notice
  subject text,
  body text,
  sent_to text,
  sent_at timestamptz,
  status text not null default 'pending', -- sent | failed | pending
  error text,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- PAYMENTS
-- ----------------------------------------------------------------------------
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  repair_id uuid not null references public.repairs(id) on delete cascade,
  amount_due numeric(10,2) not null default 0,
  amount_paid numeric(10,2) not null default 0,
  method payment_method,
  paid_at timestamptz,
  staff_id uuid references public.users(id),
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- AUDIT LOG — append-only. Undo never deletes rows, it writes a reversing row.
-- ----------------------------------------------------------------------------
create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  repair_id uuid references public.repairs(id) on delete cascade,
  actor_id uuid references public.users(id),
  actor_name text,
  action text not null,
  from_value jsonb,
  to_value jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_log_repair_idx on public.audit_log (repair_id, created_at desc);

-- ----------------------------------------------------------------------------
-- SENDER SYNC STATUS — track Sender.net subscriber sync per customer
-- ----------------------------------------------------------------------------
create table if not exists public.sender_sync_status (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  status text not null default 'pending', -- synced | failed | pending
  last_synced_at timestamptz,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (customer_id)
);

-- ----------------------------------------------------------------------------
-- updated_at trigger for repairs
-- ----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists repairs_set_updated_at on public.repairs;
create trigger repairs_set_updated_at
  before update on public.repairs
  for each row execute function public.set_updated_at();

-- ============================================================================
-- ROW LEVEL SECURITY
-- There is no Supabase Auth session in this app (single shared shop
-- computer, no logins) — so RLS can no longer key off auth.uid(). Instead,
-- RLS is enabled on every table with NO policies at all for the anon or
-- authenticated roles, meaning those roles get zero access (RLS defaults to
-- deny when enabled and no matching policy exists). The Next.js server is
-- the only client that ever talks to this database, always using the
-- service-role key (lib/supabase/admin.ts), which bypasses RLS entirely.
-- Do not add anon/authenticated policies here — if the browser ever needs
-- data, add a server route instead.
-- ============================================================================

alter table public.users enable row level security;
alter table public.customers enable row level security;
alter table public.technicians enable row level security;
alter table public.services enable row level security;
alter table public.repairs enable row level security;
alter table public.repair_items enable row level security;
alter table public.quote_versions enable row level security;
alter table public.quote_version_items enable row level security;
alter table public.quote_approvals enable row level security;
alter table public.communications enable row level security;
alter table public.payments enable row level security;
alter table public.audit_log enable row level security;
alter table public.sender_sync_status enable row level security;
alter table public.repair_number_counters enable row level security;
