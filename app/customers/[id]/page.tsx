import { notFound } from "next/navigation";
import { createAdminClient as createClient } from "@/lib/supabase/admin";
import Pill from "@/components/Pill";
import { formatMoney, formatDate, STATUS_LABELS, STATUS_COLORS } from "@/lib/format";
import CustomerEditForm from "./CustomerEditForm";

export const dynamic = "force-dynamic";

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: customer } = await supabase.from("customers").select("*").eq("id", id).single();
  if (!customer) notFound();

  const { data: repairs } = await supabase
    .from("repairs")
    .select("*")
    .eq("customer_id", id)
    .order("created_at", { ascending: false });

  const current = (repairs ?? []).filter((r) => r.status !== "collected" && !r.archived_at);
  const history = (repairs ?? []).filter((r) => r.status === "collected" || r.archived_at);

  return (
    <div className="space-y-5">
      <CustomerEditForm customer={customer} />

      <section className="card">
        <h2 className="mb-2 text-sm font-semibold text-slate-800">Current repairs</h2>
        <RepairList repairs={current} empty="No current repairs." />
      </section>

      <section className="card">
        <h2 className="mb-2 text-sm font-semibold text-slate-800">History</h2>
        <RepairList repairs={history} empty="No past repairs." />
      </section>
    </div>
  );
}

function RepairList({
  repairs,
  empty,
}: {
  repairs: { id: string; repair_number: string; status: string; brand: string | null; model: string | null; quote_total: number; received_at: string }[];
  empty: string;
}) {
  if (repairs.length === 0) return <p className="text-sm text-slate-400">{empty}</p>;
  return (
    <ul className="divide-y divide-slate-100 text-sm">
      {repairs.map((r) => (
        <li key={r.id} className="flex items-center justify-between py-1.5">
          <a href={`/repairs/${r.id}`} className="hover:underline">
            {r.repair_number} — {r.brand} {r.model}
          </a>
          <span className="flex items-center gap-2 text-xs text-slate-500">
            {formatDate(r.received_at)} · {formatMoney(r.quote_total)}
            <Pill label={STATUS_LABELS[r.status]} className={STATUS_COLORS[r.status]} />
          </span>
        </li>
      ))}
    </ul>
  );
}
