import { createAdminClient as createClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/currentUser";
import { formatDateTime, customerFullName } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const supabase = await createClient();
  const user = await getCurrentUser();

  const { data: staff } = await supabase.from("users").select("*").order("name");
  const { data: failedSync } = await supabase
    .from("sender_sync_status")
    .select("*, customers(first_name, last_name, email)")
    .eq("status", "failed")
    .order("updated_at", { ascending: false });

  return (
    <div className="max-w-2xl space-y-5">
      <h1 className="text-xl font-semibold text-slate-900">Settings</h1>

      <section className="card space-y-2">
        <h2 className="text-sm font-semibold text-slate-800">Signed in as</h2>
        <p className="text-sm text-slate-600">
          {user?.name} ({user?.role})
        </p>
      </section>

      <section className="card space-y-2">
        <h2 className="text-sm font-semibold text-slate-800">Staff</h2>
        <ul className="divide-y divide-slate-100 text-sm">
          {(staff ?? []).map((s) => (
            <li key={s.id} className="flex items-center justify-between py-1.5">
              <span>{s.name}</span>
              <span className="text-xs uppercase text-slate-500">{s.role}</span>
            </li>
          ))}
        </ul>
        <p className="text-xs text-slate-400">
          Staff are just rows in the public.users table — no login, no passwords. Add or
          remove people by editing that table directly (see supabase/seed.sql).
        </p>
      </section>

      <section className="card space-y-2">
        <h2 className="text-sm font-semibold text-slate-800">
          Mailing list sync issues
        </h2>
        <ul className="divide-y divide-slate-100 text-sm">
          {(failedSync ?? []).map((s) => {
            const c = s.customers as { first_name: string; last_name: string; email: string } | null;
            return (
              <li key={s.id} className="py-1.5">
                <div className="font-medium">{c ? customerFullName(c) : "Unknown customer"}</div>
                <div className="text-xs text-rose-500">{s.error}</div>
                <div className="text-xs text-slate-400">Last attempt {formatDateTime(s.updated_at)}</div>
              </li>
            );
          })}
          {(!failedSync || failedSync.length === 0) && (
            <li className="py-1.5 text-slate-400">No sync issues.</li>
          )}
        </ul>
      </section>
    </div>
  );
}
