import { NextRequest, NextResponse } from "next/server";
import { createAdminClient as createClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/currentUser";
import { getNextRepairNumber } from "@/lib/repairNumber";
import { logAction } from "@/lib/audit";
import { generateApprovalToken } from "@/lib/tokens";
import { sendApprovalEmail } from "@/lib/sender";

export const dynamic = "force-dynamic";

interface LineItem {
  service_id?: string | null;
  description: string;
  quantity: number;
  unit_price: number;
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const appUser = await getCurrentUser();
  if (!appUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const {
    customer_id,
    instrument_type,
    instrument_description,
    brand,
    model,
    serial_number,
    work_description,
    quote_total,
    line_items,
    technician_required,
    technician_id,
    technician_pay,
    verbally_discussed,
    notes,
    location_type,
    location_text,
    send_approval_email,
  } = body as {
    customer_id: string;
    instrument_type: string;
    instrument_description?: string;
    brand?: string;
    model?: string;
    serial_number?: string;
    work_description?: string;
    quote_total: number;
    line_items?: LineItem[];
    technician_required?: boolean;
    technician_id?: string | null;
    technician_pay?: number | null;
    verbally_discussed?: boolean;
    notes?: string;
    location_type?: string;
    location_text?: string;
    send_approval_email?: boolean;
  };

  if (!customer_id || !instrument_type) {
    return NextResponse.json(
      { error: "customer_id and instrument_type are required" },
      { status: 400 }
    );
  }

  const repairNumber = await getNextRepairNumber(supabase);

  const { data: repair, error } = await supabase
    .from("repairs")
    .insert({
      repair_number: repairNumber,
      customer_id,
      instrument_type,
      instrument_description: instrument_description || null,
      brand: brand || null,
      model: model || null,
      serial_number: serial_number || null,
      work_description: work_description || null,
      quote_total: quote_total ?? 0,
      status: "received",
      location_type: location_type || "repair_room",
      location_text: location_text || null,
      technician_required: !!technician_required,
      technician_id: technician_required ? technician_id || null : null,
      technician_pay: technician_required ? technician_pay ?? null : null,
      verbally_discussed: !!verbally_discussed,
      notes: notes || null,
      created_by: appUser?.id ?? null,
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  if (line_items && line_items.length > 0) {
    await supabase.from("repair_items").insert(
      line_items.map((li) => ({
        repair_id: repair.id,
        service_id: li.service_id || null,
        description: li.description,
        quantity: li.quantity,
        unit_price: li.unit_price,
        line_total: li.quantity * li.unit_price,
      }))
    );
  }

  // First quote version, mirrors the repair as created.
  const { data: quoteVersion } = await supabase
    .from("quote_versions")
    .insert({
      repair_id: repair.id,
      version_number: 1,
      work_description: work_description || null,
      total: quote_total ?? 0,
      created_by: appUser?.id ?? null,
    })
    .select("*")
    .single();

  if (quoteVersion && line_items && line_items.length > 0) {
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

  await logAction(supabase, {
    repairId: repair.id,
    actorId: appUser?.id ?? null,
    actorName: appUser?.name ?? null,
    action: "repair_created",
    toValue: repair,
  });

  let emailWarning: string | null = null;

  if (send_approval_email && quoteVersion) {
    const { token, tokenHash, expiresAt } = generateApprovalToken();
    await supabase.from("quote_approvals").insert({
      quote_version_id: quoteVersion.id,
      repair_id: repair.id,
      token_hash: tokenHash,
      token_expires_at: expiresAt,
      response: "pending",
    });
    await supabase
      .from("quote_versions")
      .update({ sent_at: new Date().toISOString() })
      .eq("id", quoteVersion.id);

    const { data: customer } = await supabase
      .from("customers")
      .select("*")
      .eq("id", customer_id)
      .single();

    if (customer?.email) {
      const result = await sendApprovalEmail(supabase, {
        repairId: repair.id,
        repairNumber: repair.repair_number,
        customerEmail: customer.email,
        customerName: `${customer.first_name} ${customer.last_name}`,
        workDescription: work_description || "",
        total: quote_total ?? 0,
        token,
      });
      emailWarning = result.warning ?? null;
    } else {
      emailWarning = "Customer has no email on file — approval email was not sent.";
    }

    await logAction(supabase, {
      repairId: repair.id,
      actorId: appUser?.id ?? null,
      actorName: appUser?.name ?? null,
      action: "approval_sent",
      toValue: { quote_version_id: quoteVersion.id },
    });
  }

  return NextResponse.json({ repair, warning: emailWarning });
}
