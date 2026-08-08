"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { clearStaff } from "@/lib/actions/session";

const LINKS = [
  { href: "/", label: "Repairs" },
  { href: "/customers", label: "Customers" },
  { href: "/technician-payments", label: "Technician Payments" },
  { href: "/services", label: "Services" },
  { href: "/archived", label: "Archived" },
  { href: "/settings", label: "Settings" },
];

export default function NavBar({ userName }: { userName?: string | null }) {
  const pathname = usePathname();

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-2.5">
        <div className="flex flex-wrap items-center gap-1">
          <span className="mr-3 text-sm font-semibold text-slate-800">
            Repair Notebook
          </span>
          <nav className="flex flex-wrap gap-1">
            {LINKS.map((link) => {
              const active =
                link.href === "/"
                  ? pathname === "/" || pathname.startsWith("/repairs")
                  : pathname.startsWith(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`rounded-md px-2.5 py-1.5 text-sm ${
                    active
                      ? "bg-slate-900 text-white"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-500">
          {userName && <span>{userName}</span>}
          <form action={clearStaff}>
            <button
              type="submit"
              className="rounded-md px-2 py-1 text-slate-500 hover:bg-slate-100"
            >
              Switch user
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
