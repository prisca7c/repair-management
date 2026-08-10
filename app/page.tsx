import Link from "next/link";
import { createAdminClient as createClient } from "@/lib/supabase/admin";
import Pill from "@/components/Pill";
import InfoIcon from "@/components/InfoIcon";
import {
  formatMoney,
  formatDate,
  customerFullName,
  STATUS_LABELS,
  STATUS_COLORS,
  SELECTABLE_STATUSES,
  APPROVAL_LABELS,
  APPROVAL_COLORS,
  LOCATION_LABELS,
} from "@/lib/format";

export const dynamic = "force-dynamic";

function instrumentLabel(r: { instrument_description: string | null; brand: string | null; model: string | null }) {
  return r.instrument_description || [r.brand, r.model].filter(Boolean).join(" ") || "-";
}

interface SearchParams {
  q?: string;
  status?: string;
  unpaid?: string;
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { q, status, unpaid } = await searchParams;
  const supabase = await createClient();

  const { data: repairs } = await supabase
    .from("repairs")
    .select("*, customers(first_name, last_name, email, phone)")
    .is("archived_at", null)
    .order("created_at", { ascending: false });

  const all = repairs ?? [];

  // Latest approval per repair (for the approval-status column).
  const repairIds = all.map((r) => r.id);
  let approvalsByRepair: Record<string, { response: string }> = {};
  if (repairIds.length > 0) {
    const { data: approvals } = await supabase
      .from("quote_approvals")
      .select("repair_id, response, created_at")
      .in("repair_id", repairIds)
      .order("created_at", { ascending: false });
    approvalsByRepair = {};
    for (const a of approvals ?? []) {
      if (!approvalsByRepair[a.repair_id]) {
        approvalsByRepair[a.repair_id] = { response: a.response };
      }
    }
  }

  const counters = {
    received: all.filter((r) => r.status === "received").length,
    working: all.filter((r) => r.status === "working").length,
    ready: all.filter((r) => r.status === "ready").length,
    unpaid: all.filter((r) => r.status === "collected" && !r.customer_paid).length,
  };

  const term = (q ?? "").trim().toLowerCase();
  let filtered = all;
  if (term) {
    filtered = filtered.filter((r) => {
      const c = r.customers as { first_name: string; last_name: string; email: string | null; phone: string | null } | null;
      const haystack = [
        r.repair_number,
        c ? customerFullName(c) : "",
        c?.email,
        c?.phone,
        r.instrument_description,
        r.brand,
        r.model,
        r.work_description,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(term);
    });
  }
  if (status) {
    filtered = filtered.filter((r) => r.status === status);
  }
  if (unpaid) {
    filtered = filtered.filter((r) => r.status === "collected" && !r.customer_paid);
  }

  const offSite = all.filter(
    (r) =>
      r.status !== "collected" &&
      (r.location_type === "home_staff" || r.location_type === "home_technician")
  );

  // Picked up already but payment is still owed — separate from "Ready"
  // (Ready = done, sitting in the shop, not yet picked up; payment status
  // doesn't affect that). This is the list that needs chasing for money.
  const unpaidPickups = all.filter((r) => r.status === "collected" && !r.customer_paid);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-slate-900">Repairs</h1>
        <Link href="/repairs/new" className="btn-primary">
          + New repair
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <CounterCard
          label="Received"
          value={counters.received}
          href="/?status=received"
          info="Just came in — not started yet."
        />
        <CounterCard
          label="Working"
          value={counters.working}
          href="/?status=working"
          info="Customer approved and it's actively being worked on."
        />
        <CounterCard
          label="Ready"
          value={counters.ready}
          href="/?status=ready"
          info="Fixed and waiting in the shop — not picked up yet, regardless of payment."
        />
        <CounterCard
          label="Not paid yet"
          value={counters.unpaid}
          href="/?unpaid=1"
          info="Picked up already but payment is still owed. Should normally stay at 0."
        />
      </div>

      {unpaidPickups.length > 0 && (
        <div className="card border-amber-200 bg-amber-50">
          <h2 className="mb-2 text-sm font-semibold text-amber-900">
            Picked up but not paid ({unpaidPickups.length})
          </h2>
          <ul className="divide-y divide-amber-100 text-sm">
            {unpaidPickups.map((r) => {
              const c = r.customers as { first_name: string; last_name: string } | null;
              return (
                <li key={r.id} className="flex items-center justify-between py-1.5">
                  <Link href={`/repairs/${r.id}`} className="text-amber-900 hover:underline">
                    {r.repair_number} — {c ? customerFullName(c) : "Unknown"} — {instrumentLabel(r)}
                  </Link>
                  <span className="text-xs font-medium text-amber-800">{formatMoney(r.quote_total)} owed</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {offSite.length > 0 && (
        <div className="card">
          <h2 className="mb-2 text-sm font-semibold text-slate-800">
            Instruments currently off-site ({offSite.length})
          </h2>
          <ul className="divide-y divide-slate-100 text-sm">
            {offSite.map((r) => {
              const c = r.customers as { first_name: string; last_name: string } | null;
              return (
                <li key={r.id} className="flex items-center justify-between py-1.5">
                  <Link href={`/repairs/${r.id}`} className="text-slate-700 hover:underline">
                    {r.repair_number} — {c ? customerFullName(c) : "Unknown"} —{" "}
                    {instrumentLabel(r)}
                  </Link>
                  <span className="text-xs text-slate-500">
                    {LOCATION_LABELS[r.location_type]}
                    {r.location_text ? ` — ${r.location_text}` : ""}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <form className="flex flex-wrap items-center gap-2" method="get">
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Search repair #, name, phone, email, instrument, work…"
          className="input max-w-sm"
        />
        <select name="status" defaultValue={status ?? ""} className="input max-w-[160px]">
          <option value="">All statuses</option>
          {SELECTABLE_STATUSES.map((k) => (
            <option key={k} value={k}>
              {STATUS_LABELS[k]}
            </option>
          ))}
        </select>
        <button type="submit" className="btn-secondary">
          Search
        </button>
        {(q || status || unpaid) && (
          <Link href="/" className="text-sm text-slate-500 hover:underline" prefetch={false}>
            Clear
          </Link>
        )}
      </form>

      <div className="card overflow-x-auto p-0">
        <table className="hidden w-full text-left text-sm sm:table">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <Th>Repair #</Th>
              <Th>Date</Th>
              <Th>Customer</Th>
              <Th>Instrument</Th>
              <Th>Work</Th>
              <Th>
                Client £ <InfoIcon text="The quoted total the customer will be charged." />
              </Th>
              <Th>
                Approval <InfoIcon text="Approval can only change to Approved via the customer's own approval link." />
              </Th>
              <Th>Status</Th>
              <Th>Done</Th>
              <Th>Client Paid</Th>
              <Th>
                Location <InfoIcon text="Where the instrument physically is right now." />
              </Th>
              <Th>
                Tech £ <InfoIcon text="What we owe the external technician for this job." />
              </Th>
              <Th>Tech Paid</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map((r) => {
              const c = r.customers as { first_name: string; last_name: string } | null;
              const approval = approvalsByRepair[r.id]?.response ?? "pending";
              return (
                <tr key={r.id} className="hover:bg-slate-50">
                  <Td>
                    <Link href={`/repairs/${r.id}`} className="font-medium text-slate-900 hover:underline">
                      {r.repair_number}
                    </Link>
                  </Td>
                  <Td>{formatDate(r.received_at)}</Td>
                  <Td>{c ? customerFullName(c) : "-"}</Td>
                  <Td>{instrumentLabel(r)}</Td>
                  <Td className="max-w-[200px] truncate">{r.work_description}</Td>
                  <Td>{formatMoney(r.quote_total)}</Td>
                  <Td>
                    <Pill label={APPROVAL_LABELS[approval]} className={APPROVAL_COLORS[approval]} />
                  </Td>
                  <Td>
                    <Pill label={STATUS_LABELS[r.status]} className={STATUS_COLORS[r.status]} />
                  </Td>
                  <Td>{r.job_done ? "Yes" : "No"}</Td>
                  <Td>{r.customer_paid ? "Yes" : "No"}</Td>
                  <Td>{LOCATION_LABELS[r.location_type]}</Td>
                  <Td>{r.technician_required ? formatMoney(r.technician_pay ?? 0) : "-"}</Td>
                  <Td>{r.technician_required ? (r.technician_paid ? "Yes" : "No") : "-"}</Td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={13} className="px-3 py-6 text-center text-sm text-slate-400">
                  No repairs match.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Mobile stacked cards */}
        <div className="divide-y divide-slate-100 sm:hidden">
          {filtered.map((r) => {
            const c = r.customers as { first_name: string; last_name: string } | null;
            const approval = approvalsByRepair[r.id]?.response ?? "pending";
            return (
              <Link
                key={r.id}
                href={`/repairs/${r.id}`}
                className="block px-3 py-3 hover:bg-slate-50"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-slate-900">{r.repair_number}</span>
                  <Pill label={STATUS_LABELS[r.status]} className={STATUS_COLORS[r.status]} />
                </div>
                <div className="mt-1 text-sm text-slate-600">
                  {c ? customerFullName(c) : "-"} — {instrumentLabel(r)}
                </div>
                <div className="mt-1 flex items-center justify-between text-xs text-slate-500">
                  <span>{formatMoney(r.quote_total)}</span>
                  <Pill label={APPROVAL_LABELS[approval]} className={APPROVAL_COLORS[approval]} />
                </div>
              </Link>
            );
          })}
          {filtered.length === 0 && (
            <div className="px-3 py-6 text-center text-sm text-slate-400">
              No repairs match.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CounterCard({
  label,
  value,
  href,
  info,
}: {
  label: string;
  value: number;
  href: string;
  info?: string;
}) {
  return (
    <div className="card relative hover:border-slate-300">
      <Link href={href} className="block" prefetch={false}>
        <div className="text-2xl font-semibold text-slate-900">{value}</div>
        <div className="text-xs text-slate-500">{label}</div>
      </Link>
      {info && (
        <div className="absolute right-3 top-3">
          <InfoIcon text={info} />
        </div>
      )}
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="whitespace-nowrap px-3 py-2 font-medium">{children}</th>;
}

function Td({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <td className={`px-3 py-2 ${className ?? ""}`}>{children}</td>;
}
