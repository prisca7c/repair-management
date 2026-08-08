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

export const STATUS_LABELS: Record<string, string> = {
  received: "Received",
  working: "Working",
  waiting: "Waiting",
  ready: "Ready",
  collected: "Collected",
};

export const STATUS_COLORS: Record<string, string> = {
  received: "bg-slate-100 text-slate-700",
  working: "bg-blue-100 text-blue-700",
  waiting: "bg-amber-100 text-amber-800",
  ready: "bg-emerald-100 text-emerald-700",
  collected: "bg-gray-200 text-gray-600",
};

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

export const LOCATION_LABELS: Record<string, string> = {
  repair_room: "Repair room",
  home_staff: "Home (staff)",
  home_technician: "Home (technician)",
  other: "Other",
};
