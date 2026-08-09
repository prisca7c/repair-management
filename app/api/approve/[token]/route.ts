import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashToken } from "@/lib/tokens";

export const dynamic = "force-dynamic";

// This route is PUBLIC (no auth) and uses the service-role client, since an
// anonymous customer has zero direct table access under RLS. Every response
// is deliberately narrow: only what a customer needs to approve/decline a
// quote, never technician pay, staff notes, internal location, margins, or
// any other repair.

async function loadApprovalByToken(token: string) {
  const admin = createAdminClient();
  const tokenHash = hashToken(token);

  const { data: approval } = await admin
    .from("quote_approvals")
    .select(
      "*, quote_versions(*, quote_version_items(*)), repairs(id, repair_number, instrument_type, instrument_description, brand, model, work_description, quote_total)"
    )
    .eq("token_hash", tokenHash)
    .maybeSingle();

  return { admin, approval };
}

function publicView(approval: NonNullable<Awaited<ReturnType<typeof loadApprovalByToken>>["approval"]>) {
  const repair = approval.repairs as {
    repair_number: string;
    instrument_type: string;
    instrument_description: string | null;
    brand: string | null;
    model: string | null;
    work_description: string | null;
    quote_total: number;
  } | null;
  const quoteVersion = approval.quote_versions as {
    work_description: string | null;
    total: number;
    version_number: number;
    quote_version_items?: { description: string; quantity: number; unit_price: number; line_total: number }[];
  } | null;

  const expired = new Date(approval.token_expires_at).getTime() < Date.now();

  return {
    repairNumber: repair?.repair_number ?? "",
    instrument: [repair?.brand, repair?.model, repair?.instrument_description].filter(Boolean).join(" ") || repair?.instrument_type,
    workDescription: quoteVersion?.work_description ?? repair?.work_description ?? "",
    total: quoteVersion?.total ?? repair?.quote_total ?? 0,
    lineItems: quoteVersion?.quote_version_items ?? [],
    response: approval.response as "pending" | "approved" | "declined",
    customerMessage: approval.customer_message,
    expired,
    expiresAt: approval.token_expires_at,
  };
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const { approval } = await loadApprovalByToken(token);

  if (!approval) {
    return NextResponse.json({ error: "This approval link is invalid." }, { status: 404 });
  }

  return NextResponse.json({ view: publicView(approval) });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const body = await req.json().catch(() => ({}));
  const response = body.response as "approved" | "declined" | "undo" | undefined;
  const message = (body.message as string | undefined)?.slice(0, 2000) ?? null;

  if (response !== "approved" && response !== "declined" && response !== "undo") {
    return NextResponse.json({ error: "Invalid response" }, { status: 400 });
  }

  const { admin, approval } = await loadApprovalByToken(token);

  if (!approval) {
    return NextResponse.json({ error: "This approval link is invalid." }, { status: 404 });
  }

  // Undo — lets the customer walk back a mis-click while the tab is still
  // open. Only allowed while it's still the same, unresolved approval (i.e.
  // nothing else has moved the repair along since).
  if (response === "undo") {
    if (approval.response === "pending") {
      return NextResponse.json({ view: publicView(approval) });
    }
    const wasApproved = approval.response === "approved";
    const repairId = approval.repair_id as string;

    await admin
      .from("quote_approvals")
      .update({ response: "pending", responded_at: null, customer_message: null })
      .eq("id", approval.id);

    if (wasApproved) {
      // Only revert working -> received if nothing has moved on since (e.g.
      // staff hasn't already started work in a status beyond "working").
      await admin.from("repairs").update({ status: "received" }).eq("id", repairId).eq("status", "working");
    }

    await admin.from("audit_log").insert({
      repair_id: repairId,
      actor_id: null,
      actor_name: "Customer (via approval link)",
      action: "customer_undo_response",
      to_value: { quote_approval_id: approval.id },
    });

    const { approval: latest } = await loadApprovalByToken(token);
    return NextResponse.json({ view: latest ? publicView(latest) : null });
  }

  const expired = new Date(approval.token_expires_at).getTime() < Date.now();
  if (expired) {
    return NextResponse.json({ error: "This approval link has expired.", view: publicView(approval) }, { status: 410 });
  }

  // Idempotent: once responded, do not allow toggling — just return the
  // final state.
  if (approval.response !== "pending") {
    return NextResponse.json({ view: publicView(approval), alreadyResponded: true });
  }

  const respondedAt = new Date().toISOString();

  const { data: updatedApproval, error } = await admin
    .from("quote_approvals")
    .update({
      response,
      responded_at: respondedAt,
      customer_message: message,
    })
    .eq("id", approval.id)
    .eq("response", "pending") // extra guard against a race double-submit
    .select("*")
    .single();

  if (error || !updatedApproval) {
    // Someone else responded in the meantime — re-fetch and return final state.
    const { approval: latest } = await loadApprovalByToken(token);
    return NextResponse.json({ view: latest ? publicView(latest) : null, alreadyResponded: true });
  }

  const repairId = approval.repair_id as string;

  if (response === "approved") {
    await admin.from("repairs").update({ status: "working" }).eq("id", repairId).eq("status", "received");
  }

  await admin.from("audit_log").insert({
    repair_id: repairId,
    actor_id: null,
    actor_name: "Customer (via approval link)",
    action: response === "approved" ? "customer_approved" : "customer_declined",
    to_value: { quote_approval_id: approval.id, message },
  });

  // Internal staff notification: logged to audit_log above. Wiring an
  // actual email to a shop inbox would use sendRepairEmail() from
  // lib/sender.ts once a REPAIR_STAFF_NOTIFY_EMAIL env var is configured —
  // left as a TODO since no such address was specified in the brief.

  const { approval: finalApproval } = await loadApprovalByToken(token);

  return NextResponse.json({ view: finalApproval ? publicView(finalApproval) : null });
}
