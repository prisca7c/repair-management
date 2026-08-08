import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import type { AppUser } from "@/lib/database.types";
import { STAFF_COOKIE_NAME } from "@/lib/staffCookie";

/**
 * Returns the currently "picked" staff user's app-level profile
 * (public.users row), or null if no one has been picked yet / the cookie
 * points at a user that no longer exists.
 *
 * There is no Supabase Auth session involved — this shop runs on a single
 * shared computer, so "who's using it" is just a lightweight cookie set by
 * the staff picker at /login. Looks up the row via the service-role admin
 * client since RLS grants no access to the anon/authenticated roles.
 */
export async function getCurrentUser(): Promise<AppUser | null> {
  const cookieStore = await cookies();
  const staffId = cookieStore.get(STAFF_COOKIE_NAME)?.value;

  if (!staffId) return null;

  const supabase = createAdminClient();
  const { data } = await supabase
    .from("users")
    .select("*")
    .eq("id", staffId)
    .maybeSingle();

  return (data as AppUser) ?? null;
}
