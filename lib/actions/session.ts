"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { STAFF_COOKIE_NAME } from "@/lib/staffCookie";

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

/**
 * "Sign in" for the shared shop computer — no password, just pick who you
 * are from the staff list. Validates the id is a real public.users row
 * before setting the cookie so a stale/garbage id can never get through.
 */
export async function pickStaff(formData: FormData) {
  const userId = formData.get("userId");
  if (typeof userId !== "string" || !userId) {
    redirect("/login");
  }

  const supabase = createAdminClient();
  const { data: user } = await supabase
    .from("users")
    .select("id")
    .eq("id", userId)
    .maybeSingle();

  if (!user) {
    redirect("/login");
  }

  const cookieStore = await cookies();
  cookieStore.set(STAFF_COOKIE_NAME, userId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: ONE_YEAR_SECONDS,
  });

  redirect("/");
}

/** "Switch user" — clears the picked-staff cookie and returns to the picker. */
export async function clearStaff() {
  const cookieStore = await cookies();
  cookieStore.delete(STAFF_COOKIE_NAME);
  redirect("/login");
}

/**
 * Add a new staff member from the Settings page — no login/password system,
 * so this just inserts a row into public.users that will then show up on
 * the "Who are you?" picker.
 */
export async function addStaff(formData: FormData) {
  const name = (formData.get("name") as string | null)?.trim();
  const role = formData.get("role") === "admin" ? "admin" : "staff";
  if (!name) redirect("/settings?error=Name+is+required");

  const supabase = createAdminClient();
  const { error } = await supabase.from("users").insert({ name, role });
  if (error) redirect(`/settings?error=${encodeURIComponent(error.message)}`);

  redirect("/settings");
}

/**
 * Remove a staff member from the picker list. This is a soft delete
 * (active = false), not a hard delete: staff who've created repairs, quote
 * versions, payments, or audit log entries are protected by foreign key
 * constraints, so a hard delete on them silently fails (Postgres rejects
 * it, but the old code didn't check the error and just redirected as if it
 * worked). Deactivating instead always works, for any staff member, and
 * keeps their name correctly attached to the history they created.
 */
export async function removeStaff(formData: FormData) {
  const id = formData.get("id") as string | null;
  if (!id) redirect("/settings");

  const supabase = createAdminClient();
  const { error } = await supabase.from("users").update({ active: false }).eq("id", id);
  if (error) redirect(`/settings?error=${encodeURIComponent(error.message)}`);
  redirect("/settings");
}

/** Bring a deactivated staff member back onto the picker list. */
export async function restoreStaff(formData: FormData) {
  const id = formData.get("id") as string | null;
  if (!id) redirect("/settings");

  const supabase = createAdminClient();
  const { error } = await supabase.from("users").update({ active: true }).eq("id", id);
  if (error) redirect(`/settings?error=${encodeURIComponent(error.message)}`);
  redirect("/settings");
}
