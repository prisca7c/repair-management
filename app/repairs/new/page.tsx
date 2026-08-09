import NewRepairForm from "./NewRepairForm";
import { createAdminClient as createClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function NewRepairPage() {
  const supabase = await createClient();
  const { data: services } = await supabase
    .from("services")
    .select("*")
    .eq("active", true)
    .order("name");

  return (
    <div className="max-w-3xl">
      <h1 className="mb-4 text-xl font-semibold text-slate-900">New repair</h1>
      <NewRepairForm services={services ?? []} />
    </div>
  );
}
