// Kept in its own file, deliberately with zero other imports.
//
// middleware.ts (which runs on Vercel's Edge runtime, no Node APIs) needs
// this cookie name. lib/currentUser.ts also needs it, but that file pulls
// in the Supabase admin client, which is Node-only. If middleware imported
// the name from currentUser.ts, the bundler would pull the admin client
// into the Edge middleware bundle and the build would fail. Import from
// here instead in both places.
export const STAFF_COOKIE_NAME = "staff_id";
