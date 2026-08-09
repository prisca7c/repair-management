import type { Metadata } from "next";
import { Lexend } from "next/font/google";
import "./globals.css";
import NavBar from "@/components/NavBar";
import { getCurrentUser } from "@/lib/currentUser";

const lexend = Lexend({
  subsets: ["latin"],
  variable: "--font-lexend",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Repair Notebook",
  description: "Internal repair management for the shop",
};

export const dynamic = "force-dynamic";

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let userName: string | null = null;
  try {
    const user = await getCurrentUser();
    userName = user?.name ?? null;
  } catch {
    userName = null;
  }

  return (
    <html lang="en" className={`h-full antialiased ${lexend.variable}`}>
      <body className="min-h-full flex flex-col bg-slate-50 text-slate-900 font-sans">
        {userName && <NavBar userName={userName} />}
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
          {children}
        </main>
      </body>
    </html>
  );
}
