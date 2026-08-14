export function formatMoney(value: number | null | undefined): string {
  const n = value ?? 0;
  return `£${n.toFixed(2)}`;
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "-";
  const d = new Date(value);
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "-";
  const d = new Date(value);
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function customerFullName(c: { first_name: string; last_name: string }) {
  return `${c.first_name} ${c.last_name}`.trim();
}

// "Waiting" was retired as a status — the enum still has the value for old
// data, but the app no longer sets it. These fall back to a generic label so
// any leftover legacy row still renders sensibly instead of showing blank.
export const STATUS_LABELS: Record<string, string> = {
  received: "Received",
  working: "Working",
  waiting: "Working",
  ready: "Ready",
  collected: "Collected",
};

export const STATUS_COLORS: Record<string, string> = {
  received: "bg-slate-100 text-slate-700",
  working: "bg-blue-100 text-blue-700",
  waiting: "bg-blue-100 text-blue-700",
  ready: "bg-emerald-100 text-emerald-700",
  collected: "bg-gray-200 text-gray-600",
};

/** Statuses staff can actually pick — "waiting" is retired. */
export const SELECTABLE_STATUSES = ["received", "working", "ready", "collected"] as const;

export const APPROVAL_LABELS: Record<string, string> = {
  pending: "Awaiting approval",
  approved: "Approved",
  declined: "Declined",
};

export const APPROVAL_COLORS: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800",
  approved: "bg-emerald-100 text-emerald-700",
  declined: "bg-rose-100 text-rose-700",
};

/**
 * Single combined status used on the dashboard list, folding the separate
 * approval concept into the same pill as the repair's status: a repair the
 * customer hasn't approved yet (or has declined) shows as "Awaiting
 * approval" regardless of its underlying `status` column; once approved it
 * shows its real status (Received/Working/Ready/Collected), which staff
 * move forward manually — approving a quote never jumps it to Working by
 * itself.
 */
export function dashboardStatus(
  repairStatus: string,
  approvalResponse: string
): string {
  if (approvalResponse !== "approved" && repairStatus !== "collected") {
    return "awaiting_approval";
  }
  return repairStatus;
}

export const DASHBOARD_STATUS_LABELS: Record<string, string> = {
  awaiting_approval: "Awaiting approval",
  ...STATUS_LABELS,
};

export const DASHBOARD_STATUS_COLORS: Record<string, string> = {
  awaiting_approval: "bg-amber-100 text-amber-800",
  ...STATUS_COLORS,
};

export const PAYMENT_REQUIRED_LABELS: Record<string, string> = {
  none: "Not required upfront",
  deposit: "Deposit required",
  full: "Full payment required",
};

export const LOCATION_LABELS: Record<string, string> = {
  repair_room: "Repair room",
  home_staff: "Home (staff)",
  home_technician: "Home (technician)",
  other: "Other",
};

// ----------------------------------------------------------------------------
// Audit log descriptions — turns the raw action name + from_value/to_value
// jsonb blobs stored by every route into a specific, human-readable summary
// (e.g. "Status: Received → Working; Location: Repair room → Home (staff)")
// instead of just showing the generic action name like "field update".
// ----------------------------------------------------------------------------

const AUDIT_FIELD_LABELS: Record<string, string> = {
  instrument_type: "Instrument type",
  instrument_description: "Instrument description",
  brand: "Brand",
  model: "Model",
  serial_number: "Serial number",
  photo_url: "Photo",
  work_description: "Work description",
  quote_total: "Quote total",
  status: "Status",
  waiting_reason: "Waiting reason",
  location_type: "Location",
  location_text: "Location details",
  technician_required: "Technician required",
  technician_pay: "Technician pay",
  technician_paid: "Technician paid",
  technician_paid_at: "Technician paid at",
  job_done: "Job done",
  customer_paid: "Customer paid",
  verbally_discussed: "Discussed verbally",
  notes: "Notes",
  payment_required_type: "Payment required",
  deposit_amount: "Deposit amount",
  received_at: "Received at",
  ready_at: "Ready at",
  collected_at: "Collected at",
  archived_at: "Archived at",
  response: "Response",
  cancelled_by_staff: "Cancelled by staff",
  cancellation_reason: "Cancellation reason",
  cancelled_at: "Cancelled at",
  customer_message: "Customer message",
  payment_confirmed: "Payment confirmed",
  payment_confirmed_at: "Payment confirmed at",
};

const AUDIT_MONEY_FIELDS = new Set(["technician_pay", "deposit_amount", "quote_total", "total"]);
const AUDIT_DATE_FIELDS = new Set([
  "received_at",
  "ready_at",
  "collected_at",
  "archived_at",
  "technician_paid_at",
  "cancelled_at",
  "payment_confirmed_at",
  "responded_at",
]);

function formatAuditValue(key: string, value: unknown): string {
  if (value === null || value === undefined || value === "") return "-";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (key === "status") return STATUS_LABELS[String(value)] ?? String(value);
  if (key === "location_type") return LOCATION_LABELS[String(value)] ?? String(value);
  if (key === "payment_required_type") return PAYMENT_REQUIRED_LABELS[String(value)] ?? String(value);
  if (key === "response") return APPROVAL_LABELS[String(value)] ?? String(value);
  if (AUDIT_MONEY_FIELDS.has(key)) return formatMoney(Number(value));
  if (AUDIT_DATE_FIELDS.has(key)) return formatDateTime(String(value));
  return String(value);
}

/**
 * Diffs two flat objects field-by-field into "Label: before → after"
 * strings, skipping keys that didn't actually change, plus ids and
 * nested/object values that aren't meant to be shown to staff directly.
 */
function diffFields(from: Record<string, unknown> | null, to: Record<string, unknown> | null): string[] {
  const keys = new Set([...Object.keys(from ?? {}), ...Object.keys(to ?? {})]);
  const changes: string[] = [];
  for (const key of keys) {
    if (key === "id" || key === "created_at" || key === "updated_at" || key.endsWith("_id")) continue;
    const fromRaw = from?.[key];
    const toRaw = to?.[key];
    if (typeof fromRaw === "object" && fromRaw !== null) continue;
    if (typeof toRaw === "object" && toRaw !== null) continue;
    const fromVal = formatAuditValue(key, fromRaw);
    const toVal = formatAuditValue(key, toRaw);
    if (fromVal !== toVal) {
      changes.push(`${AUDIT_FIELD_LABELS[key] ?? key.replace(/_/g, " ")}: ${fromVal} → ${toVal}`);
    }
  }
  return changes;
}

export function describeAudit(entry: { action: string; from_value: unknown; to_value: unknown }): string {
  const { action } = entry;
  const from = (entry.from_value ?? null) as Record<string, unknown> | null;
  const to = (entry.to_value ?? null) as Record<string, unknown> | null;

  switch (action) {
    case "repair_created":
      return "Repair created";
    case "approval_sent":
      return "Approval email sent to customer";
    case "quote_revised": {
      const total = to?.total;
      const version = to?.version_number;
      return `Quote revised${version ? ` (v${version})` : ""}${
        typeof total === "number" ? ` — new total ${formatMoney(total)}` : ""
      }, approval email sent`;
    }
    case "customer_approved":
      return `Customer approved the quote${to?.message ? ` — "${to.message}"` : ""}`;
    case "customer_declined":
      return `Customer declined the quote${to?.message ? ` — "${to.message}"` : ""}`;
    case "customer_undo_response":
      return "Customer undid their approval response";
    case "quote_approval_cancelled":
      return `Staff cancelled the approval${to?.reason ? ` — "${to.reason}"` : ""}`;
    case "undo_quote_approval_cancelled":
      return "Approval cancellation undone";
    default: {
      const changes = diffFields(from, to);
      if (changes.length > 0) return changes.join("; ");
      const fallback: Record<string, string> = {
        collect: "Marked collected",
        undo_collect: "Collection undone",
        archive: "Repair archived",
        undo_archive: "Archive undone",
        restore: "Repair restored from archive",
        technician_paid: "Technician marked as paid",
        undo_technician_paid: "Technician payment undone",
        field_update: "Repair updated",
        undo_field_update: "Change undone",
      };
      return fallback[action] ?? action.replace(/_/g, " ");
    }
  }
}
