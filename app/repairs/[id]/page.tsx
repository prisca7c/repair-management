import { notFound } from "next/navigation";
import Link from "next/link";
import { createAdminClient as createClient } from "@/lib/supabase/admin";
import Pill from "@/components/Pill";
import InfoIcon from "@/components/InfoIcon";
import {
  formatMoney,
  formatDateTime,
  customerFullName,
  STATUS_LABELS,
  STATUS_COLORS,
  APPROVAL_LABELS,
  APPROVAL_COLORS,
  LOCATION_LABELS,
} from "@/lib/format";
import RepairActions from "./RepairActions";
import EditableFields from "./EditableFields";

export const dynamic = "force-dynamic";

export default async function RepairDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: repair } = await supabase
    .from("repairs")
    .select("*, customers(*)")
    .eq("id", id)
    .single();

  if (!repair) notFound();

  const [{ data: quoteVersions }, { data: approvals }, { data: communications }, { data: auditLog }, { data: repairItems }] =
    await Promise.all([
      supabase
        .from("quote_versions")
        .select("*, quote_version_items(*)")
        .eq("repair_id", id)
        .order("version_number", { ascending: false }),
      supabase
        .from("quote_approvals")
        .select("*")
        .eq("repair_id", id)
        .order("created_at", { ascending: false }),
      supabase
        .from("communications")
        .select("*")
        .eq("repair_id", id)
        .order("created_at", { ascending: false }),
      supabase
        .from("audit_log")
        .select("*")
        .eq("repair_id", id)
        .order("created_at", { ascending: false })
        .limit(30),
      supabase.from("repair_items").select("*").eq("repair_id", id),
    ]);

  const customer = repair.customers as {
    id: string;
    first_name: string;
    last_name: string;
    email: string | null;
    phone: string | null;
  } | null;

  const latestApproval = approvals?.[0] ?? null;
  const latestQuoteVersion = quoteVersions?.[0] ?? null;
  const quoteChanged = Boolean(
    quoteVersions && quoteVersions.length > 1 && latestApproval?.quote_version_id !== latestQuoteVersion?.id
  );
  // If the quote has moved on since the last approval response, the
  // customer has not approved the CURRENT version — display as awaiting,
  // even though the stored row for the old version still says approved.
  const approvalStatus = quoteChanged ? "pending" : latestApproval?.response ?? "pending";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold text-slate-900">{repair.repair_number}</h1>
            <Pill label={STATUS_LABELS[repair.status]} className={STATUS_COLORS[repair.status]} />
            <Pill label={APPROVAL_LABELS[approvalStatus]} className={APPROVAL_COLORS[approvalStatus]} />
            {latestApproval?.cancelled_by_staff && <Pill label="Approval cancelled" className="bg-rose-100 text-rose-700" />}
          </div>
          <p className="mt-1 text-sm text-slate-500">
            {customer ? (
              <Link href={`/customers/${customer.id}`} className="hover:underline">
                {customerFullName(customer)}
              </Link>
            ) : (
              "Unknown customer"
            )}
            {" · "}
            {repair.instrument_description || [repair.brand, repair.model].filter(Boolean).join(" ") || "-"}
          </p>
        </div>
      </div>

      {quoteChanged && (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          This changes a previously approved quote — the customer has not approved the current version yet.
        </div>
      )}

      <RepairActions
        repair={repair}
        customer={customer}
        latestApproval={latestApproval}
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <section className="card space-y-3">
            <h2 className="text-sm font-semibold text-slate-800">Repair details</h2>
            <EditableFields repair={repair} customer={customer} />
          </section>

          <section className="card space-y-2">
            <h2 className="flex items-center text-sm font-semibold text-slate-800">
              Quote history
              <InfoIcon text="Every approval request creates a new immutable quote version. Old versions and their approval history are never deleted." />
            </h2>
            <ul className="space-y-2">
              {(quoteVersions ?? []).map((qv) => {
                const approvalForVersion = approvals?.find((a) => a.quote_version_id === qv.id);
                return (
                  <li key={qv.id} className="rounded-md border border-slate-200 p-2 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-medium">v{qv.version_number}</span>
                      <span>{formatMoney(qv.total)}</span>
                      {approvalForVersion && (
                        <Pill
                          label={
                            approvalForVersion.cancelled_by_staff
                              ? "Cancelled by staff"
                              : APPROVAL_LABELS[approvalForVersion.response]
                          }
                          className={
                            approvalForVersion.cancelled_by_staff
                              ? "bg-rose-100 text-rose-700"
                              : APPROVAL_COLORS[approvalForVersion.response]
                          }
                        />
                      )}
                    </div>
                    <p className="mt-1 text-slate-600">{qv.work_description}</p>
                    <p className="mt-1 text-xs text-slate-400">
                      Created {formatDateTime(qv.created_at)}
                      {qv.sent_at ? ` · Sent ${formatDateTime(qv.sent_at)}` : ""}
                      {approvalForVersion?.responded_at
                        ? ` · Responded ${formatDateTime(approvalForVersion.responded_at)}`
                        : ""}
                    </p>
                    {approvalForVersion?.customer_message && (
                      <p className="mt-1 text-xs italic text-slate-500">
                        &ldquo;{approvalForVersion.customer_message}&rdquo;
                      </p>
                    )}
                  </li>
                );
              })}
              {(!quoteVersions || quoteVersions.length === 0) && (
                <p className="text-sm text-slate-400">No quote versions yet.</p>
              )}
            </ul>
            {repairItems && repairItems.length > 0 && (
              <div className="mt-2 border-t border-slate-100 pt-2">
                <h3 className="mb-1 text-xs font-semibold uppercase text-slate-500">Current price breakdown</h3>
                <ul className="text-sm text-slate-600">
                  {repairItems.map((it) => (
                    <li key={it.id} className="flex justify-between">
                      <span>
                        {it.description} × {it.quantity}
                      </span>
                      <span>{formatMoney(it.line_total)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>

          <section className="card space-y-2">
            <h2 className="text-sm font-semibold text-slate-800">Communications</h2>
            <ul className="divide-y divide-slate-100 text-sm">
              {(communications ?? []).map((c) => (
                <li key={c.id} className="py-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-medium capitalize">{c.type.replace("_", " ")}</span>
                    <Pill
                      label={c.status}
                      className={
                        c.status === "sent"
                          ? "bg-emerald-100 text-emerald-700"
                          : c.status === "failed"
                          ? "bg-rose-100 text-rose-700"
                          : "bg-slate-100 text-slate-600"
                      }
                    />
                  </div>
                  <p className="text-xs text-slate-400">
                    To {c.sent_to} · {formatDateTime(c.sent_at ?? c.created_at)}
                  </p>
                  {c.error && <p className="text-xs text-rose-500">{c.error}</p>}
                </li>
              ))}
              {(!communications || communications.length === 0) && (
                <p className="py-1.5 text-sm text-slate-400">No communications yet.</p>
              )}
            </ul>
          </section>
        </div>

        <div className="space-y-5">
          <section className="card space-y-2">
            <h2 className="flex items-center text-sm font-semibold text-slate-800">
              Location
              <InfoIcon text="Where the instrument physically is right now. Update this whenever it moves." />
            </h2>
            <p className="text-sm text-slate-700">
              {LOCATION_LABELS[repair.location_type]}
              {repair.location_text ? ` — ${repair.location_text}` : ""}
            </p>
          </section>

          {repair.technician_required && (
            <section className="card space-y-2">
              <h2 className="flex items-center text-sm font-semibold text-slate-800">
                Technician
                <InfoIcon text="What we owe the external technician for this job." />
              </h2>
              <p className="text-sm text-slate-700">
                Pay: {formatMoney(repair.technician_pay)} — {repair.technician_paid ? "Paid" : "Unpaid"}
                {repair.technician_paid_at ? ` (${formatDateTime(repair.technician_paid_at)})` : ""}
              </p>
            </section>
          )}

          <section className="card space-y-2">
            <h2 className="text-sm font-semibold text-slate-800">Checklist</h2>
            <ChecklistRow label="Job done" value={repair.job_done} />
            <ChecklistRow label="Customer paid" value={repair.customer_paid} />
            {repair.technician_required && (
              <ChecklistRow label="Technician paid" value={repair.technician_paid} />
            )}
            <ChecklistRow label="Discussed verbally" value={repair.verbally_discussed} />
          </section>

          <section className="card space-y-2">
            <h2 className="text-sm font-semibold text-slate-800">Notes</h2>
            <p className="whitespace-pre-wrap text-sm text-slate-600">{repair.notes || "-"}</p>
          </section>

          <section className="card space-y-2">
            <h2 className="text-sm font-semibold text-slate-800">Audit history</h2>
            <ul className="max-h-72 space-y-1.5 overflow-y-auto text-xs text-slate-500">
              {(auditLog ?? []).map((a) => (
                <li key={a.id} className="border-b border-slate-100 pb-1.5">
                  <span className="font-medium text-slate-700">{a.action.replace(/_/g, " ")}</span>
                  {" · "}
                  {a.actor_name ?? "System"}
                  {" · "}
                  {formatDateTime(a.created_at)}
                </li>
              ))}
              {(!auditLog || auditLog.length === 0) && <li>No history yet.</li>}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}

function ChecklistRow({ label, value }: { label: string; value: boolean }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-slate-600">{label}</span>
      <Pill
        label={value ? "Yes" : "No"}
        className={value ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}
      />
    </div>
  );
}
