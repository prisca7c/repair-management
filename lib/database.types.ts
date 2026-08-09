// Hand-written minimal types for the tables this app touches. Not generated
// from the live schema — if you add columns in Supabase, update here too.

export type UserRole = "admin" | "staff";
export type InstrumentType = "guitar" | "bass" | "ukulele" | "violin" | "other";
export type RepairStatus = "received" | "working" | "waiting" | "ready" | "collected";
export type WaitingReason = "customer" | "parts" | "technician" | "other";
export type LocationType = "repair_room" | "home_staff" | "home_technician" | "other";
export type ApprovalResponse = "pending" | "approved" | "declined";
export type PaymentMethod = "cash" | "card";

export interface AppUser {
  id: string;
  email: string | null;
  name: string;
  role: UserRole;
  created_at: string;
}

export interface Customer {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  notes: string | null;
  marketing_consent: boolean;
  created_at: string;
}

export interface Technician {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  notes: string | null;
  active: boolean;
  created_at: string;
}

export interface Service {
  id: string;
  name: string;
  description: string | null;
  price: number;
  active: boolean;
  sort_order: number;
  created_at: string;
}

export interface Repair {
  id: string;
  repair_number: string;
  customer_id: string;
  instrument_type: InstrumentType;
  instrument_description: string | null;
  brand: string | null;
  model: string | null;
  serial_number: string | null;
  photo_url: string | null;
  work_description: string | null;
  quote_total: number;
  status: RepairStatus;
  waiting_reason: WaitingReason | null;
  location_type: LocationType;
  location_text: string | null;
  location_staff_id: string | null;
  technician_required: boolean;
  technician_id: string | null;
  technician_pay: number | null;
  technician_paid: boolean;
  technician_paid_at: string | null;
  job_done: boolean;
  customer_paid: boolean;
  verbally_discussed: boolean;
  notes: string | null;
  received_at: string;
  ready_at: string | null;
  collected_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
}

export interface RepairItem {
  id: string;
  repair_id: string;
  service_id: string | null;
  description: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  created_at: string;
}

export interface QuoteVersion {
  id: string;
  repair_id: string;
  version_number: number;
  work_description: string | null;
  total: number;
  created_by: string | null;
  created_at: string;
  sent_at: string | null;
}

export interface QuoteVersionItem {
  id: string;
  quote_version_id: string;
  description: string;
  quantity: number;
  unit_price: number;
  line_total: number;
}

export interface QuoteApproval {
  id: string;
  quote_version_id: string;
  repair_id: string;
  token_hash: string;
  token_expires_at: string;
  response: ApprovalResponse;
  customer_message: string | null;
  responded_at: string | null;
  cancelled_by_staff: boolean;
  cancelled_by_user_id: string | null;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  created_at: string;
}

export interface Communication {
  id: string;
  repair_id: string;
  type: string;
  subject: string | null;
  body: string | null;
  sent_to: string | null;
  sent_at: string | null;
  status: "sent" | "failed" | "pending";
  error: string | null;
  created_at: string;
}

export interface Payment {
  id: string;
  repair_id: string;
  amount_due: number;
  amount_paid: number;
  method: PaymentMethod | null;
  paid_at: string | null;
  staff_id: string | null;
  created_at: string;
}

export interface AuditLogEntry {
  id: string;
  repair_id: string | null;
  actor_id: string | null;
  actor_name: string | null;
  action: string;
  from_value: unknown;
  to_value: unknown;
  created_at: string;
}

export interface SenderSyncStatus {
  id: string;
  customer_id: string;
  status: "synced" | "failed" | "pending";
  last_synced_at: string | null;
  error: string | null;
  created_at: string;
  updated_at: string;
}
