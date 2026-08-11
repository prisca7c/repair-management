import { createAdminClient as createClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/currentUser";
import { formatDateTime, customerFullName } from "@/lib/format";
import { addStaff, removeStaff, restoreStaff } from "@/lib/actions/session";

export const dynamic = "force-dynamic";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const supabase = await createClient();
  const user = await getCurrentUser();

  const { data: allStaff } = await supabase.from("users").select("*").order("name");
  const staff = (allStaff ?? []).filter((s) => s.active);
  const inactiveStaff = (allStaff ?? []).filter((s) => !s.active);
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

      <section className="card space-y-3">
        <h2 className="text-sm font-semibold text-slate-800">Staff</h2>
        {error && (
          <div className="rounded-md border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </div>
        )}
        <ul className="divide-y divide-slate-100 text-sm">
          {staff.map((s) => (
            <li key={s.id} className="flex items-center justify-between py-1.5">
              <span>{s.name}</span>
              <div className="flex items-center gap-3">
                <span className="text-xs uppercase text-slate-500">{s.role}</span>
                <form action={removeStaff}>
                  <input type="hidden" name="id" value={s.id} />
                  <button type="submit" className="text-xs text-rose-500 hover:underline">
                    Remove
                  </button>
                </form>
              </div>
            </li>
          ))}
          {staff.length === 0 && (
            <li className="py-1.5 text-slate-400">No staff set up yet.</li>
          )}
        </ul>

        <form action={addStaff} className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
          <input className="input max-w-[220px]" type="text" name="name" placeholder="Staff name" required />
          <select className="input max-w-[140px]" name="role" defaultValue="staff">
            <option value="staff">Staff</option>
            <option value="admin">Admin</option>
          </select>
          <button type="submit" className="btn-primary">
            + Add staff
          </button>
        </form>
        <p className="text-xs text-slate-400">
          No login or passwords — staff just pick their name on the &ldquo;Who are you?&rdquo; screen. Adding
          someone here makes them show up on that list immediately. Removing someone just hides them from that
          list — their name stays on any repairs/history they created, since that can&apos;t be deleted.
        </p>

        {inactiveStaff.length > 0 && (
          <div className="border-t border-slate-100 pt-3">
            <h3 className="mb-1 text-xs font-semibold uppercase text-slate-500">Removed staff</h3>
            <ul className="divide-y divide-slate-100 text-sm">
              {inactiveStaff.map((s) => (
                <li key={s.id} className="flex items-center justify-between py-1.5 text-slate-400">
                  <span>{s.name}</span>
                  <form action={restoreStaff}>
                    <input type="hidden" name="id" value={s.id} />
                    <button type="submit" className="text-xs text-slate-500 hover:underline">
                      Restore
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section className="card space-y-2">
        <h2 className="text-sm font-semibold text-slate-800">
          Mailing list sync issues
        </h2>
        <p className="text-xs text-slate-400">
          Whenever a customer is added or their marketing-email preference changes, we sync them to the
          Sender.net mailing list in the background. If that call fails (bad API key, Sender.net down, etc.)
          it&apos;s logged here instead of blocking the repair — this is where you&apos;d notice and fix it.
        </p>
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
