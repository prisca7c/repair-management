import { NextRequest, NextResponse } from "next/server";
import { createAdminClient as createClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/currentUser";
import { generateApprovalToken } from "@/lib/tokens";
import { sendApprovalEmail } from "@/lib/sender";

export const dynamic = "force-dynamic";

interface LineItem {
  description: string;
  quantity: number;
  unit_price: number;
}

/**
 * Creates a new immutable quote_version. Prior versions (and their
 * quote_approvals rows) are never modified — this only ever inserts.
 * The repair's quote_total/work_description are updated to match so the
 * repair reflects the latest quote.
 *
 * A revised quote always needs a fresh customer approval, so this
 * immediately creates a new (pending) quote_approvals row and sends the
 * approval email for it automatically — the customer is notified of every
 * quote change without staff having to separately click "Resend approval".
 * This mirrors exactly what happens when the first quote (v1) is sent.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const appUser = await getCurrentUser();
  if (!appUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { work_description, total, line_items } = body as {
    work_description: string;
    total: number;
    line_items?: LineItem[];
  };

  const { data: latest } = await supabase
    .from("quote_versions")
    .select("version_number")
    .eq("repair_id", id)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextVersion = (latest?.version_number ?? 0) + 1;

  const { data: quoteVersion, error } = await supabase
    .from("quote_versions")
    .insert({
      repair_id: id,
      version_number: nextVersion,
      work_description,
      total,
      created_by: appUser?.id ?? null,
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  if (line_items && line_items.length > 0) {
    await supabase.from("quote_version_items").insert(
      line_items.map((li) => ({
        quote_version_id: quoteVersion.id,
        description: li.description,
        quantity: li.quantity,
        unit_price: li.unit_price,
        line_total: li.quantity * li.unit_price,
      }))
    );
  }

  const { data: before } = await supabase.from("repairs").select("*, customers(*)").eq("id", id).single();

  await supabase
    .from("repairs")
    .update({ work_description, quote_total: total })
    .eq("id", id);

  if (line_items) {
    await supabase.from("repair_items").delete().eq("repair_id", id);
    if (line_items.length > 0) {
      await supabase.from("repair_items").insert(
        line_items.map((li) => ({
          repair_id: id,
          description: li.description,
          quantity: li.quantity,
          unit_price: li.unit_price,
          line_total: li.quantity * li.unit_price,
        }))
      );
    }
  }

  await supabase.from("audit_log").insert({
    repair_id: id,
    actor_id: appUser?.id ?? null,
    actor_name: appUser?.name ?? null,
    action: "quote_revised",
    from_value: before,
    to_value: quoteVersion,
  });

  // A revised quote always needs a fresh approval — automatically create a
  // pending quote_approvals row for this new version and email the
  // customer, exactly like the first quote sent at creation. Without this,
  // the quote history would show v1 with a proper awaiting/approved pill
  // but every revised version stuck with no approval row at all, and the
  // customer would never be told the quote changed unless staff remembered
  // to separately hit "Resend approval".
  let warning: string | null = null;
  const customer = before?.customers as { email: string | null; first_name: string; last_name: string } | null;

  if (customer?.email) {
    const { token, tokenHash, expiresAt } = generateApprovalToken();
    await supabase.from("quote_approvals").insert({
      quote_version_id: quoteVersion.id,
      repair_id: id,
      token_hash: tokenHash,
      token_expires_at: expiresAt,
      response: "pending",
    });
    await supabase.from("quote_versions").update({ sent_at: new Date().toISOString() }).eq("id", quoteVersion.id);

    const paymentRequiredType = before?.payment_required_type as "none" | "deposit" | "full" | undefined;
    const result = await sendApprovalEmail(supabase, {
      repairId: id,
      repairNumber: before!.repair_number,
      customerEmail: customer.email,
      customerName: `${customer.first_name} ${customer.last_name}`,
      workDescription: work_description || "",
      total,
      token,
      lineItems: line_items ?? [],
      internalNotes: before?.notes,
      paymentRequired:
        paymentRequiredType && paymentRequiredType !== "none"
          ? {
              type: paymentRequiredType,
              amount: paymentRequiredType === "deposit" ? before?.deposit_amount ?? 0 : total,
            }
          : null,
    });
    warning = result.warning ?? null;

    await supabase.from("audit_log").insert({
      repair_id: id,
      actor_id: appUser?.id ?? null,
      actor_name: appUser?.name ?? null,
      action: "approval_sent",
      to_value: { quote_version_id: quoteVersion.id },
    });
  } else {
    warning = "Customer has no email on file — the revised quote was saved but no approval email was sent.";
  }

  return NextResponse.json({ quoteVersion, warning });
}
