// NOTE: uses the Supabase service role key — only import from server-side code.
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Service-role client. NEVER import this from a Client Component or expose
// it to the browser — `server-only` will throw a build error if you try.
// Used exclusively by trusted server code: API routes for the public
// approval flow (token validated first), server-side email/sync jobs, and
// admin utilities like repair-number allocation.
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars"
    );
  }

  return createSupabaseClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
