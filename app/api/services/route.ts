import { NextRequest, NextResponse } from "next/server";
import { createAdminClient as createClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/currentUser";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("services")
    .select("*")
    .order("name", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ services: data });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const appUser = await getCurrentUser();
  if (!appUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { name, description, price, active } = body;
  if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });

  const { data, error } = await supabase
    .from("services")
    .insert({
      name,
      description: description || null,
      price: price ?? 0,
      active: active ?? true,
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ service: data });
}
