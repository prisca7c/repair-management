-- ============================================================================
-- Seed data for the Repair Shop MVP.
-- IMPORTANT: run schema.sql first.
--
-- Staff are just rows in public.users — there's no Supabase Auth, no
-- passwords, no email verification. This app runs on a single shared shop
-- computer; staff just pick their name from a list at /login to attribute
-- actions in the audit log. Add/remove people by editing this table.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- STAFF
-- ----------------------------------------------------------------------------
insert into public.users (id, name, role) values
  ('00000000-0000-0000-0000-000000000001', 'Christine', 'admin'),
  ('00000000-0000-0000-0000-000000000002', 'Dunni', 'staff'),
  ('00000000-0000-0000-0000-000000000003', 'Franklin', 'staff'),
  ('00000000-0000-0000-0000-000000000004', 'Orlando', 'staff'),
  ('00000000-0000-0000-0000-000000000005', 'Yanice', 'staff')
on conflict (id) do nothing;

-- ----------------------------------------------------------------------------
-- SERVICES (safe to run anytime — idempotent on name)
-- ----------------------------------------------------------------------------
insert into public.services (name, description, price, active)
select * from (values
  ('Cleaning', 'General clean of the instrument', 10.00, true),
  ('Restring', 'Full set of new strings fitted', 25.00, true),
  ('Deep clean + restring', 'Deep clean plus a full restring', 35.00, true),
  ('Minimum bench charge / small repair', 'Minimum charge for small bench jobs', 35.00, true),
  ('Basic setup', 'Basic setup — from', 70.00, true)
) as v(name, description, price, active)
where not exists (select 1 from public.services s where s.name = v.name);

-- ----------------------------------------------------------------------------
-- TECHNICIAN (for the example technician-assigned repair)
-- ----------------------------------------------------------------------------
insert into public.technicians (id, name, email, phone, active)
select '10000000-0000-0000-0000-000000000001', 'James Smith', 'james.smith.tech@example.com', null, true
where not exists (select 1 from public.technicians where name = 'James Smith');

-- ----------------------------------------------------------------------------
-- EXAMPLE CUSTOMERS
-- ----------------------------------------------------------------------------
insert into public.customers (id, first_name, last_name, email, phone, marketing_consent)
select '20000000-0000-0000-0000-000000000001', 'Sarah', 'Jones', 'sarah.jones@example.com', '07700900001', false
where not exists (select 1 from public.customers where id = '20000000-0000-0000-0000-000000000001');

insert into public.customers (id, first_name, last_name, email, phone, marketing_consent)
select '20000000-0000-0000-0000-000000000002', 'James', 'Lee', 'james.lee@example.com', '07700900002', false
where not exists (select 1 from public.customers where id = '20000000-0000-0000-0000-000000000002');

insert into public.customers (id, first_name, last_name, email, phone, marketing_consent)
select '20000000-0000-0000-0000-000000000003', 'Amy', 'Wong', 'amy.wong@example.com', '07700900003', false
where not exists (select 1 from public.customers where id = '20000000-0000-0000-0000-000000000003');

-- ----------------------------------------------------------------------------
-- R-2026-0001 — Sarah Jones / Fender Stratocaster / Restring+setup / £95
-- Status: received, awaiting approval, repair room, no technician
-- ----------------------------------------------------------------------------
insert into public.repairs (
  id, repair_number, customer_id, instrument_type, instrument_description, brand, model,
  work_description, quote_total, status, location_type, technician_required,
  verbally_discussed, received_at
)
select
  '30000000-0000-0000-0000-000000000001', 'R-2026-0001', '20000000-0000-0000-0000-000000000001',
  'guitar', 'Electric guitar', 'Fender', 'Stratocaster',
  'Restring and full setup', 95.00, 'received', 'repair_room', false,
  true, now()
where not exists (select 1 from public.repairs where repair_number = 'R-2026-0001');

insert into public.quote_versions (id, repair_id, version_number, work_description, total, created_at)
select '40000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 1,
  'Restring and full setup', 95.00, now()
where not exists (select 1 from public.quote_versions where id = '40000000-0000-0000-0000-000000000001');

insert into public.quote_approvals (id, quote_version_id, repair_id, token_hash, token_expires_at, response)
select '50000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001',
  '30000000-0000-0000-0000-000000000001', 'seed-placeholder-hash-0001', now() + interval '14 days', 'pending'
where not exists (select 1 from public.quote_approvals where id = '50000000-0000-0000-0000-000000000001');

-- ----------------------------------------------------------------------------
-- R-2026-0002 — James Lee / Gibson Les Paul / Electronics repair / £140
-- Status: working, approved, home with technician, tech James Smith £60 unpaid
-- ----------------------------------------------------------------------------
insert into public.repairs (
  id, repair_number, customer_id, instrument_type, instrument_description, brand, model,
  work_description, quote_total, status, location_type, location_text,
  technician_required, technician_id, technician_pay, technician_paid,
  verbally_discussed, received_at
)
select
  '30000000-0000-0000-0000-000000000002', 'R-2026-0002', '20000000-0000-0000-0000-000000000002',
  'guitar', 'Electric guitar', 'Gibson', 'Les Paul',
  'Electronics repair — faulty pickup selector switch', 140.00, 'working', 'home_technician',
  'With James Smith (technician)', true, '10000000-0000-0000-0000-000000000001', 60.00, false,
  true, now()
where not exists (select 1 from public.repairs where repair_number = 'R-2026-0002');

insert into public.quote_versions (id, repair_id, version_number, work_description, total, created_at)
select '40000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000002', 1,
  'Electronics repair — faulty pickup selector switch', 140.00, now()
where not exists (select 1 from public.quote_versions where id = '40000000-0000-0000-0000-000000000002');

insert into public.quote_approvals (id, quote_version_id, repair_id, token_hash, token_expires_at, response, responded_at)
select '50000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000002',
  '30000000-0000-0000-0000-000000000002', 'seed-placeholder-hash-0002', now() + interval '14 days', 'approved', now()
where not exists (select 1 from public.quote_approvals where id = '50000000-0000-0000-0000-000000000002');

-- ----------------------------------------------------------------------------
-- R-2026-0003 — Amy Wong / Yamaha Acoustic / Restring / £25
-- Status: ready, repair room, no technician
-- ----------------------------------------------------------------------------
insert into public.repairs (
  id, repair_number, customer_id, instrument_type, instrument_description, brand, model,
  work_description, quote_total, status, location_type, technician_required,
  job_done, verbally_discussed, received_at, ready_at
)
select
  '30000000-0000-0000-0000-000000000003', 'R-2026-0003', '20000000-0000-0000-0000-000000000003',
  'guitar', 'Acoustic guitar', 'Yamaha', 'F310',
  'Restring', 25.00, 'ready', 'repair_room', false,
  true, true, now(), now()
where not exists (select 1 from public.repairs where repair_number = 'R-2026-0003');

insert into public.quote_versions (id, repair_id, version_number, work_description, total, created_at)
select '40000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000003', 1,
  'Restring', 25.00, now()
where not exists (select 1 from public.quote_versions where id = '40000000-0000-0000-0000-000000000003');

insert into public.quote_approvals (id, quote_version_id, repair_id, token_hash, token_expires_at, response, responded_at)
select '50000000-0000-0000-0000-000000000003', '40000000-0000-0000-0000-000000000003',
  '30000000-0000-0000-0000-000000000003', 'seed-placeholder-hash-0003', now() + interval '14 days', 'approved', now()
where not exists (select 1 from public.quote_approvals where id = '50000000-0000-0000-0000-000000000003');

-- Seed the per-year repair number counter so the next real repair created via
-- the app continues from R-2026-0004.
insert into public.repair_number_counters (year, last_seq) values (2026, 3)
on conflict (year) do update set last_seq = greatest(public.repair_number_counters.last_seq, excluded.last_seq);
