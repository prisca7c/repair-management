import { notFound } from "next/navigation";
import { createAdminClient as createClient } from "@/lib/supabase/admin";
import EditForm from "./EditForm";

export const dynamic = "force-dynamic";

export default async function EditRepairPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: repair } = await supabase.from("repairs").select("*").eq("id", id).single();
  if (!repair) notFound();

  const { data: repairItems } = await supabase.from("repair_items").select("*").eq("repair_id", id);
  const { data: services } = await supabase
    .from("services")
    .select("*")
    .eq("active", true)
    .order("sort_order")
    .order("name");
  const { data: latestApproval } = await supabase
    .from("quote_approvals")
    .select("*")
    .eq("repair_id", id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (
    <div className="max-w-3xl">
      <h1 className="mb-4 text-xl font-semibold text-slate-900">Edit {repair.repair_number}</h1>
      <EditForm
        repair={repair}
        repairItems={repairItems ?? []}
        services={services ?? []}
        isApproved={latestApproval?.response === "approved" && !latestApproval.cancelled_by_staff}
      />
    </div>
  );
}
