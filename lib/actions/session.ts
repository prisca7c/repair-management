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

/** Remove a staff member from the picker list. */
export async function removeStaff(formData: FormData) {
  const id = formData.get("id") as string | null;
  if (!id) redirect("/settings");

  const supabase = createAdminClient();
  await supabase.from("users").delete().eq("id", id);
  redirect("/settings");
}
