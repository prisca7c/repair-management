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
