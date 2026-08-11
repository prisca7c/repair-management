import { createAdminClient as createClient } from "@/lib/supabase/admin";
import { customerFullName } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const supabase = await createClient();
  let query = supabase.from("customers").select("*").order("created_at", { ascending: false });

  if (q) {
    const like = `%${q}%`;
    query = query.or(`first_name.ilike.${like},last_name.ilike.${like},email.ilike.${like},phone.ilike.${like}`);
  }

  const { data: customers } = await query;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-900">Customers</h1>
      </div>
      <form className="flex gap-2" method="get">
        <input className="input max-w-sm" name="q" defaultValue={q} placeholder="Search name, email, phone…" />
        <button className="btn-secondary" type="submit">
          Search
        </button>
        {q && (
          <a href="/customers" className="text-sm text-slate-500 hover:underline self-center">
            Clear
          </a>
        )}
      </form>
      <div className="card overflow-x-auto p-0">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2 font-medium">Name</th>
              <th className="px-3 py-2 font-medium">Email</th>
              <th className="px-3 py-2 font-medium">Phone</th>
              <th className="px-3 py-2 font-medium">Marketing</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {(customers ?? []).map((c) => (
              <tr key={c.id} className="hover:bg-slate-50">
                <td className="px-3 py-2">
                  <a href={`/customers/${c.id}`} className="font-medium text-slate-900 hover:underline">
                    {customerFullName(c)}
                  </a>
                </td>
                <td className="px-3 py-2">{c.email || "-"}</td>
                <td className="px-3 py-2">{c.phone || "-"}</td>
                <td className="px-3 py-2">{c.marketing_consent ? "Yes" : "No"}</td>
              </tr>
            ))}
            {(!customers || customers.length === 0) && (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-slate-400">
                  No customers found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
