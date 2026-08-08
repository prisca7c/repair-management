import { NextResponse, type NextRequest } from "next/server";
import { STAFF_COOKIE_NAME } from "@/lib/currentUser";

// No Supabase Auth here — this shop runs on a single shared computer with
// no passwords. The middleware only checks whether *someone* has been
// picked via /login (the staff picker); lib/currentUser.ts does the real
// lookup against public.users (and pages fall back to /login if that
// lookup comes back empty, e.g. a stale cookie pointing at a deleted user).
const PUBLIC_PATHS = ["/login"];
const PUBLIC_PREFIXES = ["/approve/", "/api/approve/", "/api/session", "/_next", "/favicon"];

function isPublicPath(pathname: string) {
  if (PUBLIC_PATHS.includes(pathname)) return true;
  return PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const staffId = request.cookies.get(STAFF_COOKIE_NAME)?.value;

  if (!staffId && !isPublicPath(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }

  if (staffId && pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
