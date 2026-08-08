import { SupabaseClient } from "@supabase/supabase-js";

/**
 * Appends one row to the audit_log. Audit history is append-only —
 * never update or delete existing rows. "Undo" is implemented by writing
 * a new reversing entry (see app/api/repairs/[id]/undo/route.ts), not by
 * deleting the entry it reverses.
 */
export async function logAction(
  db: SupabaseClient,
  params: {
    repairId: string | null;
    actorId: string | null;
    actorName: string | null;
    action: string;
    fromValue?: unknown;
    toValue?: unknown;
  }
) {
  const { repairId, actorId, actorName, action, fromValue, toValue } = params;

  const { error } = await db.from("audit_log").insert({
    repair_id: repairId,
    actor_id: actorId,
    actor_name: actorName,
    action,
    from_value: fromValue ?? null,
    to_value: toValue ?? null,
  });

  if (error) {
    // Audit logging failures should be visible in server logs but must not
    // block the primary operation that triggered them.
    console.error("[audit] failed to write audit_log entry:", error.message);
  }
}
