import { createAdminClient as createClient } from "@/lib/supabase/admin";
import TechnicianList from "./TechnicianList";

export const dynamic = "force-dynamic";

export default async function TechniciansPage() {
  const supabase = await createClient();
  const { data: technicians } = await supabase.from("technicians").select("*").order("name");

  return (
    <div className="max-w-2xl space-y-4">
      <h1 className="text-xl font-semibold text-slate-900">Technicians</h1>
      <TechnicianList technicians={technicians ?? []} />
    </div>
  );
}
