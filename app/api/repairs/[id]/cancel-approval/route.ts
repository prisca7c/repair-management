import { NextRequest, NextResponse } from "next/server";
import { createAdminClient as createClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/currentUser";
import { sendCancellationEmail } from "@/lib/sender";

export const dynamic = "force-dynamic";

/**
 * Staff can cancel an APPROVED approval (they cannot ever create one).
 * Records who/when/why on the same quote_approvals row, and emails the
 * customer. Undoable — undo restores the exact prior approval row
 * (see /api/repairs/[id]/undo, action "quote_approval_cancelled").
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
  const reason = (body.reason as string | undefined) || null;

  const { data: approval } = await supabase
    .from("quote_approvals")
    .select("*")
    .eq("repair_id", id)
    .eq("response", "approved")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!approval) {
    return NextResponse.json({ error: "No approved approval to cancel" }, { status: 400 });
  }

  const before = { ...approval };

  const { error } = await supabase
    .from("quote_approvals")
    .update({
      cancelled_by_staff: true,
      cancelled_by_user_id: appUser?.id ?? null,
      cancelled_at: new Date().toISOString(),
      cancellation_reason: reason,
    })
    .eq("id", approval.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await supabase.from("audit_log").insert({
    repair_id: id,
    actor_id: appUser?.id ?? null,
    actor_name: appUser?.name ?? null,
    action: "quote_approval_cancelled",
    from_value: before,
    to_value: { id: approval.id, cancelled: true, reason },
  });

  const { data: repair } = await supabase
    .from("repairs")
    .select("*, customers(*)")
    .eq("id", id)
    .single();

  let warning: string | null = null;
  const customer = repair?.customers as { email: string | null; first_name: string; last_name: string } | null;
  if (customer?.email) {
    const result = await sendCancellationEmail(supabase, {
      repairId: id,
      repairNumber: repair!.repair_number,
      customerEmail: customer.email,
      customerName: `${customer.first_name} ${customer.last_name}`,
      reason: reason ?? undefined,
    });
    warning = result.warning ?? null;
  }

  return NextResponse.json({ ok: true, warning, undoUrl: `/api/repairs/${id}/undo` });
}
