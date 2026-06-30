import type { Metadata, Viewport } from "next";
import { Fraunces, Inter, Caveat } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages, getTranslations } from "next-intl/server";
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

// viewport-fit=cover habilita env(safe-area-inset-*) per respectar el notch i la
// home-bar de l'iPhone (el bottom-sheet del copilot i el FAB en depenen).
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#FBF7F0",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const [supabase, locale, messages, t] = await Promise.all([
    createSupabaseServer(),
    getLocale(),
    getMessages(),
    getTranslations("footer"),
  ]);
  const { data: { user } } = await supabase.auth.getUser();
  const headerUser = user?.email ? { email: user.email } : null;

  return (
    <html
      lang={locale}
      className={`${fraunces.variable} ${inter.variable} ${caveat.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <NextIntlClientProvider locale={locale} messages={messages}>
          <div className="relative z-10 flex min-h-screen flex-col">
            <SiteHeader user={headerUser} />
            <main className="flex-1">{children}</main>
            <footer className="border-t border-ink-faint/40 py-8 mt-16">
              <div className="mx-auto max-w-6xl px-6 text-sm text-ink-soft flex flex-col sm:flex-row items-center justify-between gap-3">
                <span className="font-hand text-lg text-ink-soft">{t("tagline")} · {new Date().getFullYear()}</span>
                <nav className="flex items-center gap-4 text-xs">
                  <a href="/settings" className="hover:text-ink transition-colors">
                    {t("settings")}
                  </a>
                  <a href="/legal/privacy" className="hover:text-ink transition-colors">
                    {t("privacy")}
                  </a>
                  <a href="/legal/terms" className="hover:text-ink transition-colors">
                    {t("terms")}
                  </a>
                </nav>
              </div>
            </footer>
          </div>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
