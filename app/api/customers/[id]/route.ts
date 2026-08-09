import { NextRequest, NextResponse } from "next/server";
import { createAdminClient as createClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/currentUser";
import { syncCustomerSubscriber } from "@/lib/sender";

export const dynamic = "force-dynamic";

const EDITABLE_FIELDS = ["first_name", "last_name", "email", "phone", "notes", "marketing_consent"] as const;

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const appUser = await getCurrentUser();
  if (!appUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const update: Record<string, unknown> = {};
  for (const key of EDITABLE_FIELDS) {
    if (key in body) update[key] = body[key];
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "No editable fields provided" }, { status: 400 });
  }
  if ("first_name" in update && !update.first_name) {
    return NextResponse.json({ error: "First name is required" }, { status: 400 });
  }
  if ("last_name" in update && !update.last_name) {
    return NextResponse.json({ error: "Last name is required" }, { status: 400 });
  }

  const { data: customer, error } = await supabase
    .from("customers")
    .update(update)
    .eq("id", id)
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // Keep the mailing list in sync if their consent or email changed.
  const syncResult = await syncCustomerSubscriber(supabase, customer);

  return NextResponse.json({ customer, syncWarning: syncResult.warning ?? null });
}
