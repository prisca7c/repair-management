# Repair Management

A simple internal repair tracker for a music shop — the digital replacement for the paper repair sheet. Built with Next.js (App Router), TypeScript, Tailwind, Supabase (Postgres only — no Supabase Auth), and Sender.net for email.

## What this is (and isn't)

This is a shared notebook: who has the instrument, what was agreed, what was quoted, whether the customer approved it, where it is, whether it's done, whether it's paid. It is deliberately not a CRM — no online payments, no scheduling, no inventory, no analytics.

This app runs on a single shared computer in the shop. There's no login and no passwords — when you open it you pick your name from a short list so actions can be attributed in the audit log, and that's it. Every actual read/write to the database happens on the server using the Supabase service-role key, so the database stays locked down (RLS denies the anon/public key entirely) even though there's no app-level authentication.

## 1. Set up Supabase

1. Create a project at [supabase.com](https://supabase.com) (free tier is enough for this).
2. In the SQL editor, run `supabase/schema.sql` — creates all tables, enums, and RLS. RLS is enabled on every table with no policies for the `anon`/`authenticated` roles, so only the service-role key (used exclusively by the Next.js server) can read or write anything. The public approval flow never touches Postgres directly with anon credentials either — it goes through a server API route using the service role key.
3. Run `supabase/seed.sql`: it inserts five staff members (Christine, Dunni, Franklin, Orlando, Yanice) as plain rows in `public.users`, plus default services and three example repairs. Staff members are just rows in that table — no Supabase Auth account, no email, no password required. To add or remove staff later, just insert/delete rows in `public.users` (or edit `supabase/seed.sql` and re-run it before setup).
4. Grab your Project URL and service role key from Project Settings → API.

## 2. Set up Sender.net

1. In Sender.net, create/verify a sending domain or address you'll use for repair emails (e.g. `repairs@yourshop.co.uk`) — keep it separate from any marketing "from" address.
2. Get an API token: Integrations → API.
3. (Optional) Create a subscriber group like "Music Shop Customers" for customers who tick the marketing-consent checkbox, and grab its group ID.

## 3. Configure environment variables

Copy `.env.example` to `.env.local` and fill in real values:

```
NEXT_PUBLIC_SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
SENDER_API_TOKEN=
REPAIR_FROM_EMAIL=
REPAIR_FROM_NAME=
SENDER_CUSTOMER_GROUP_ID=
APP_BASE_URL=
```

`SUPABASE_SERVICE_ROLE_KEY` and `SENDER_API_TOKEN` are server-only — never referenced from client components. There's no anon/public Supabase key in use anywhere in the app (nothing client-side ever talks to Supabase directly — every table lookup happens in a server component or API route via the service role key), so `NEXT_PUBLIC_SUPABASE_ANON_KEY` isn't needed.

## 4. Run it

```bash
npm install
npm run dev
```

Visit `http://localhost:3000`, pick your name from the staff list. No password.

## Deploying

Any Node host works; Vercel is the path of least resistance for a Next.js app this size. Set the same environment variables in the hosting dashboard. No background workers or cron jobs are required.

## Project layout

- `supabase/schema.sql` — full schema: `users`, `customers`, `repairs`, `repair_items`, `services`, `technicians`, `quote_versions`, `quote_version_items`, `quote_approvals`, `communications`, `payments`, `audit_log`, `sender_sync_status`.
- `lib/sender.ts` — the only place that talks to Sender.net (`sendApprovalEmail`, `sendConfirmationEmail`, `sendReadyEmail`, `sendCancellationEmail`, `syncCustomerSubscriber`). All calls are soft-fail: a repair or customer always saves even if email/sync fails, and the failure is logged and surfaced as a small non-blocking warning with a retry option.
- `lib/audit.ts` / `lib/tokens.ts` / `lib/repairNumber.ts` — append-only history logging, approval-token hashing (SHA-256, 14-day expiry, raw token never stored), and per-year sequential repair numbers (`R-2026-0001`).
- `app/repairs/new` — intake form, aimed at under 30 seconds for a simple job.
- `app/repairs/[id]` — the single repair record: status, location, approval, quote history, technician section (only if required), checklist, notes, communications, and audit history, all on one page.
- `app/approve/[token]` — the public, no-login page a customer opens from their email. Shows only repair number, instrument, work, and total; never technician pay, staff notes, or internal history. Approving is the *only* way a repair's approval status becomes "Approved" — there is no staff-facing control that can do this.
- `app/technician-payments`, `app/customers`, `app/services`, `app/archived` — the supporting list pages described in the brief.

## Design rules encoded in the code

- Staff can record a quote as "discussed / agreed verbally," but that's an internal note only — it never changes approval status.
- Editing a quote after it's been approved creates a new immutable `quote_versions` row; the prior approval stays in history untouched, and the new version starts at "awaiting approval."
- Every state-changing action writes to `audit_log`. Undo doesn't delete history — it appends a reversing entry. Undoing a staff cancellation of an approval re-links the original approval event rather than fabricating a new "customer approved."
- Repairs are archived, never deleted.

## Known gaps / things to double-check before going live

- Sender.net's exact endpoint paths and payload field names (`/v2/emails`, `/v2/subscribers`, etc., depending on your account's API version) should be verified against their current docs — the abstraction in `lib/sender.ts` is isolated so this is a one-file fix if anything's changed.
- `repairs.photo_url` exists in the schema but there's no upload widget yet — it currently accepts a plain image URL.
- No automated test suite (out of scope for this MVP).

## Test workflows

Worth running through by hand after setup:

1. **Simple restring** — new repair, £25 quote, send approval, customer approves via the link, mark job done, send ready email, mark Paid & Collected (cash). No technician UI should appear anywhere in this flow.
2. **Bigger repair with a technician** — check "Requires external technician," assign a technician and pay amount, quote the customer, get approval, move location to "Home with technician," move it back to "Repair room," mark done, collect payment, then separately mark the technician paid from Technician Payments.
3. **Quote change after approval** — approve an initial quote, then edit the quote total; confirm the old approved version stays in history, a new version is created as "awaiting approval," and a revised approval email can be sent.
4. **Staff mistake / undo** — mark something like "Job done" by accident, hit Undo, confirm the audit log shows both the original action and the undo.
5. **Email failure resilience** — temporarily use a bad `SENDER_API_TOKEN` and confirm a repair still saves, with a visible but non-blocking warning and a retry option.
6. **Off-site tracking** — move a repair's location to "Home with technician," confirm it shows under "Instruments currently off-site" on the dashboard, move it back, confirm it disappears from that section, and check the audit history records both moves.
