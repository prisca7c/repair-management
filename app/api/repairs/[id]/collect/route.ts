import { NextRequest, NextResponse } from "next/server";
import { createAdminClient as createClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/currentUser";
import { sendThankYouEmail } from "@/lib/sender";

export const dynamic = "force-dynamic";

/**
 * Marks an instrument collected. Payment is a separate concern from pickup —
 * an instrument can be picked up without being paid yet (customer owes),
 * so `paid` defaults to true (the common "Paid & Collected" case) but can be
 * passed as false for "collected, payment still owed". Either way status
 * becomes "collected" so it drops off the Ready list — Ready only means
 * "done, sitting in the shop, not yet picked up", regardless of payment.
 * Undoable via the generic undo endpoint (action "collect").
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const appUser = await getCurrentUser();
  if (!appUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const method = (body.method as string) || "card";
  const amount = body.amount as number | undefined;
  const paid = body.paid !== false; // default true

  const { data: before } = await supabase.from("repairs").select("*, customers(*)").eq("id", id).single();
  if (!before) return NextResponse.json({ error: "Repair not found" }, { status: 404 });

  const collectedAt = new Date().toISOString();
  const customerPaid = paid || before.customer_paid; // never un-set a prior payment

  // Collected + paid = nothing left to track — archive it automatically.
  // Undoable: "Undo last change" reverts the collect, and archived repairs
  // can be brought back with the archive undo entry too.
  const shouldArchive = customerPaid;

  const { data: after, error } = await supabase
    .from("repairs")
    .update({
      status: "collected",
      customer_paid: customerPaid,
      job_done: true,
      collected_at: collectedAt,
      ...(shouldArchive ? { archived_at: collectedAt } : {}),
    })
    .eq("id", id)
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  if (paid) {
    await supabase.from("payments").insert({
      repair_id: id,
      amount_due: before.quote_total,
      amount_paid: amount ?? before.quote_total,
      method,
      paid_at: collectedAt,
      staff_id: appUser?.id ?? null,
    });
  }

  await supabase.from("audit_log").insert({
    repair_id: id,
    actor_id: appUser?.id ?? null,
    actor_name: appUser?.name ?? null,
    action: "collect",
    from_value: {
      status: before.status,
      customer_paid: before.customer_paid,
      collected_at: before.collected_at,
      archived_at: before.archived_at,
    },
    to_value: {
      status: after?.status,
      customer_paid: after?.customer_paid,
      collected_at: after?.collected_at,
      archived_at: after?.archived_at,
    },
  });

  let warning: string | null = null;
  const customer = before.customers as
    | { email: string | null; first_name: string; last_name: string; marketing_consent: boolean }
    | null;

  // Only if they actually paid AND opted into marketing emails.
  if (paid && customer?.marketing_consent && customer.email) {
    const result = await sendThankYouEmail(supabase, {
      repairId: id,
      repairNumber: before.repair_number,
      customerEmail: customer.email,
      customerName: `${customer.first_name} ${customer.last_name}`,
    });
    warning = result.warning ?? null;
  }

  return NextResponse.json({ ok: true, repair: after, undoUrl: `/api/repairs/${id}/undo`, warning });
}
