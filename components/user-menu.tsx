"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { LogOut, Settings, Globe } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { signOut } from "@/lib/auth-actions";
import { setLocale } from "@/lib/locale-actions";
import { cn } from "@/lib/utils";

const LOCALE_LABELS: Record<string, string> = {
  ca: "Català",
  es: "Castellano",
  en: "English",
};

const LOCALES: Array<"ca" | "es" | "en"> = ["ca", "es", "en"];

export function UserMenu({
  email,
  navItems = [],
}: {
  email: string;
  /** Enllaços de navegació que a mòbil s'amaguen del header i es mostren aquí. */
  navItems?: Array<{ href: string; label: string; active: boolean }>;
}) {
  const t = useTranslations("userMenu");
  const locale = useLocale();
  const initial = email[0]?.toUpperCase() ?? "?";
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Tanca en clicar fora o amb Escape (el <details> natiu no ho feia).
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative ml-1">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`${t("connectedAs")}: ${email}`}
        onClick={() => setOpen((v) => !v)}
        className="rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-peach/40 focus-visible:ring-offset-2 focus-visible:ring-offset-cream transition-transform hover:scale-105"
      >
        <span className="grid place-items-center h-9 w-9 rounded-full bg-sage-deep text-white text-sm font-medium shadow-[0_2px_0_0_rgba(123,151,113,0.25)]">
          {initial}
        </span>
      </button>

      {open && (
        <div
          role="menu"
          aria-label={t("connectedAs")}
          className="absolute right-0 mt-2 w-64 max-w-[calc(100vw-2rem)] rounded-lg border border-ink-faint/40 bg-cream-soft shadow-[0_8px_24px_-8px_rgba(58,46,42,0.18)] p-3 z-50"
        >
          {/* Navegació (només mòbil; a sm+ viu al header). */}
          {navItems.length > 0 && (
            <div className="sm:hidden mb-2 pb-2 border-b border-ink-faint/30 space-y-0.5">
              {navItems.map((n) => (
                <Link
                  key={n.href}
                  href={n.href}
                  role="menuitem"
                  aria-current={n.active ? "page" : undefined}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "block px-3 py-2 rounded-md text-sm transition-colors",
                    n.active
                      ? "text-ink font-medium bg-cream-deep/40"
                      : "text-ink-soft hover:text-ink hover:bg-cream-deep/60",
                  )}
                >
                  {n.label}
                </Link>
              ))}
            </div>
          )}

          <p className="text-[11px] uppercase tracking-wider text-ink-soft mb-1">
            {t("connectedAs")}
          </p>
          <p className="text-sm font-medium text-ink truncate mb-3">{email}</p>

          <Link
            href="/settings"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="w-full inline-flex items-center gap-2 px-3 py-2 rounded-md text-sm text-ink hover:bg-cream-deep/60 transition-colors"
          >
            <Settings className="h-4 w-4" strokeWidth={2} />
            {t("settings")}
          </Link>

          {/* Idioma */}
          <div className="mt-2 px-3 py-2 border-t border-ink-faint/30">
            <p className="text-[11px] uppercase tracking-wider text-ink-soft mb-2 flex items-center gap-1.5">
              <Globe className="h-3 w-3" strokeWidth={2} />
              {t("language")}
            </p>
            <div className="grid grid-cols-3 gap-1">
              {LOCALES.map((code) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => setLocale(code)}
                  className={`w-full text-xs min-h-[40px] rounded-md transition-colors ${
                    locale === code
                      ? "bg-ink text-cream"
                      : "text-ink hover:bg-cream-deep/60"
                  }`}
                  title={LOCALE_LABELS[code]}
                >
                  {code.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          <form action={signOut}>
            <button
              type="submit"
              className="w-full inline-flex items-center gap-2 px-3 py-2 rounded-md text-sm text-ink hover:bg-cream-deep/60 transition-colors mt-2"
            >
              <LogOut className="h-4 w-4" strokeWidth={2} />
              {t("signOut")}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
