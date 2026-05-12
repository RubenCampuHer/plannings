import type { Metadata } from "next";
import { Fraunces, Inter, Caveat } from "next/font/google";
import "./globals.css";
import { SiteHeader } from "@/components/site-header";
import { createSupabaseServer } from "@/lib/supabase-server";

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const caveat = Caveat({
  variable: "--font-caveat",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Plannings · Els nostres plans",
  description: "Un diari compartit de plans, escapades i somnis.",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  const headerUser = user?.email ? { email: user.email } : null;

  return (
    <html
      lang="ca"
      className={`${fraunces.variable} ${inter.variable} ${caveat.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <div className="relative z-10 flex min-h-screen flex-col">
          <SiteHeader user={headerUser} />
          <main className="flex-1">{children}</main>
          <footer className="border-t border-ink-faint/40 py-8 mt-16">
            <div className="mx-auto max-w-6xl px-6 text-sm text-ink-soft flex items-center justify-between">
              <span className="font-hand text-lg text-ink-soft">amb carinyo · {new Date().getFullYear()}</span>
              <span className="text-xs">v0.1 · diari de plans</span>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
