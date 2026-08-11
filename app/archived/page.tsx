import { createAdminClient as createClient } from "@/lib/supabase/admin";
import { formatDate, customerFullName, formatMoney } from "@/lib/format";
import RestoreButton from "./RestoreButton";

export const dynamic = "force-dynamic";

export default async function ArchivedPage() {
  const supabase = await createClient();
  const { data: repairs } = await supabase
    .from("repairs")
    .select("*, customers(first_name, last_name)")
    .not("archived_at", "is", null)
    .order("archived_at", { ascending: false });

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-slate-900">Archived repairs</h1>
      <div className="card overflow-x-auto p-0">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2 font-medium">Repair #</th>
              <th className="px-3 py-2 font-medium">Customer</th>
              <th className="px-3 py-2 font-medium">Total</th>
              <th className="px-3 py-2 font-medium">Archived</th>
              <th className="px-3 py-2 font-medium"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {(repairs ?? []).map((r) => {
              const c = r.customers as { first_name: string; last_name: string } | null;
              return (
                <tr key={r.id}>
                  <td className="px-3 py-2">
                    <a href={`/repairs/${r.id}`} className="font-medium hover:underline">
                      {r.repair_number}
                    </a>
                  </td>
                  <td className="px-3 py-2">{c ? customerFullName(c) : "-"}</td>
                  <td className="px-3 py-2">{formatMoney(r.quote_total)}</td>
                  <td className="px-3 py-2">{formatDate(r.archived_at)}</td>
                  <td className="px-3 py-2">
                    <RestoreButton repairId={r.id} />
                  </td>
                </tr>
              );
            })}
            {(!repairs || repairs.length === 0) && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-slate-400">
                  Nothing archived.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
