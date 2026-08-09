import { NextRequest, NextResponse } from "next/server";
import { createAdminClient as createClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/currentUser";

export const dynamic = "force-dynamic";

const EDITABLE_FIELDS = [
  "instrument_type",
  "instrument_description",
  "brand",
  "model",
  "serial_number",
  "photo_url",
  "work_description",
  "status",
  "waiting_reason",
  "location_type",
  "location_text",
  "location_staff_id",
  "technician_required",
  "technician_id",
  "technician_pay",
  "job_done",
  "customer_paid",
  "verbally_discussed",
  "notes",
] as const;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("repairs")
    .select("*, customers(*), technicians(*)")
    .eq("id", id)
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 404 });
  return NextResponse.json({ repair: data });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const appUser = await getCurrentUser();
  if (!appUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();

  const { data: before, error: beforeError } = await supabase
    .from("repairs")
    .select("*")
    .eq("id", id)
    .single();
  if (beforeError || !before) {
    return NextResponse.json({ error: "Repair not found" }, { status: 404 });
  }

  // Approval can NEVER be set to "approved" through this generic PATCH
  // route — that transition only happens via /api/approve/[token]. This
  // route only ever touches the `repairs` table, never quote_approvals.
  const update: Record<string, unknown> = {};
  for (const key of EDITABLE_FIELDS) {
    if (key in body) update[key] = body[key];
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "No editable fields provided" }, { status: 400 });
  }

  // Auto-timestamp status transitions.
  if (update.status === "ready" && !before.ready_at) {
    update.ready_at = new Date().toISOString();
  }

  // Collected + paid = nothing left to track — archive automatically. This
  // covers the case where "Customer paid" gets ticked after the instrument
  // was already collected unpaid (the collect route handles the "paid at
  // pickup" case itself).
  const resultingStatus = (update.status as string | undefined) ?? before.status;
  const resultingPaid = "customer_paid" in update ? Boolean(update.customer_paid) : before.customer_paid;
  if (resultingStatus === "collected" && resultingPaid && !before.archived_at) {
    update.archived_at = new Date().toISOString();
  }

  const { data: after, error } = await supabase
    .from("repairs")
    .update(update)
    .eq("id", id)
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const fromValue: Record<string, unknown> = {};
  const toValue: Record<string, unknown> = {};
  for (const key of Object.keys(update)) {
    fromValue[key] = (before as Record<string, unknown>)[key];
    toValue[key] = (after as Record<string, unknown>)[key];
  }

  const { data: auditRow } = await supabase
    .from("audit_log")
    .insert({
      repair_id: id,
      actor_id: appUser?.id ?? null,
      actor_name: appUser?.name ?? null,
      action: "field_update",
      from_value: fromValue,
      to_value: toValue,
    })
    .select("id")
    .single();

  return NextResponse.json({
    repair: after,
    auditId: auditRow?.id ?? null,
    undoUrl: auditRow ? `/api/repairs/${id}/undo` : null,
  });
}
