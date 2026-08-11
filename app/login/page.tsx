import { createAdminClient } from "@/lib/supabase/admin";
import { pickStaff } from "@/lib/actions/session";
import type { AppUser } from "@/lib/database.types";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const supabase = createAdminClient();
  const { data: staff } = await supabase
    .from("users")
    .select("id, name, role")
    .eq("active", true)
    .order("name");

  const staffList = (staff ?? []) as Pick<AppUser, "id" | "name" | "role">[];

  return (
    <div className="mx-auto mt-16 max-w-sm">
      <div className="card">
        <h1 className="mb-1 text-lg font-semibold text-slate-900">
          Repair Notebook
        </h1>
        <p className="mb-4 text-sm text-slate-500">Who are you?</p>

        {staffList.length === 0 ? (
          <p className="text-sm text-slate-500">
            No staff set up yet — run supabase/seed.sql or add rows to
            public.users.
          </p>
        ) : (
          <div className="space-y-2">
            {staffList.map((user) => (
              <form key={user.id} action={pickStaff}>
                <input type="hidden" name="userId" value={user.id} />
                <button type="submit" className="btn-primary w-full text-left">
                  {user.name}
                  <span className="ml-2 text-xs uppercase opacity-70">
                    {user.role}
                  </span>
                </button>
              </form>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
