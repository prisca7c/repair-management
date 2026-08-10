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

export const LOCATION_LABELS: Record<string, string> = {
  repair_room: "Repair room",
  home_staff: "Home (staff)",
  home_technician: "Home (technician)",
  other: "Other",
};
