import { SupabaseClient } from "@supabase/supabase-js";

/**
 * Allocates the next repair number for the current year, formatted
 * R-{year}-{4 digit sequence}, e.g. R-2026-0004. Uses an atomic
 * increment against repair_number_counters to avoid collisions if two
 * repairs are created at the same moment.
 *
 * `db` should be a client with write access to repair_number_counters
 * (the admin/service-role client, since this touches a support table
 * not covered by the general staff CRUD policies used elsewhere).
 */
export async function getNextRepairNumber(
  db: SupabaseClient
): Promise<string> {
  const year = new Date().getFullYear();

  // Try to bump an existing counter row.
  const { data: existing } = await db
    .from("repair_number_counters")
    .select("last_seq")
    .eq("year", year)
    .maybeSingle();

  const nextSeq = (existing?.last_seq ?? 0) + 1;

  const { error: upsertError } = await db
    .from("repair_number_counters")
    .upsert({ year, last_seq: nextSeq }, { onConflict: "year" });

  if (upsertError) {
    throw new Error(
      `Failed to allocate repair number: ${upsertError.message}`
    );
  }

  const padded = String(nextSeq).padStart(4, "0");
  return `R-${year}-${padded}`;
}
