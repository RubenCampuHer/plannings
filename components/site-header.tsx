"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sparkles, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { UserMenu } from "@/components/user-menu";
import { cn } from "@/lib/utils";

function NavLink({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative px-2.5 sm:px-3 py-2 text-sm font-medium rounded-lg transition-colors",
        active
          ? "text-ink"
          : "text-ink-soft hover:text-ink hover:bg-cream-deep/50",
      )}
    >
      {label}
      {active && (
        <span
          aria-hidden
          className="absolute left-2.5 right-2.5 sm:left-3 sm:right-3 -bottom-0.5 h-[2px] rounded-full bg-peach"
        />
      )}
    </Link>
  );
}

export function SiteHeader({ user }: { user: { email: string } | null }) {
  const t = useTranslations("header");
  const pathname = usePathname();
  // A `/plans/[id]` no marquem cap actiu: des del header no sabem si el plan
  // és arxivat o no, i marcar "Plans" sempre seria mentida per als arxivats.
  // El back link del CoverHero ja porta a /archive o / segons toqui.
  const isPlans = pathname === "/";
  const isArchive = pathname.startsWith("/archive");

  return (
    <header className="sticky top-0 z-30 backdrop-blur-md bg-cream/75 border-b border-ink-faint/40">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
        <Link href="/" className="flex items-center gap-2.5 group min-w-0">
          <span className="grid place-items-center h-9 w-9 shrink-0 rounded-full bg-peach text-white shadow-[0_2px_0_0_rgba(226,122,69,0.3)] motion-safe:group-hover:rotate-[8deg] transition-transform">
            <Sparkles className="h-4 w-4" strokeWidth={2.25} />
          </span>
          <span className="flex flex-col leading-none min-w-0">
            <span className="font-serif text-lg font-semibold text-ink">plannings</span>
            <span className="hidden sm:block font-hand text-[13px] text-ink-soft -mt-0.5">
              els nostres plans
            </span>
          </span>
        </Link>

        <nav className="flex items-center gap-0.5 sm:gap-1">
          {user && (
            <>
              <NavLink href="/" label={t("plans")} active={isPlans} />
              <NavLink href="/archive" label={t("archive")} active={isArchive} />
              <Link href="/plans/new" className="ml-1 sm:ml-2 inline-flex" aria-label={t("newPlan")}>
                <Button size="sm">
                  <Plus className="h-4 w-4" strokeWidth={2.5} />
                  <span className="hidden sm:inline">{t("newPlan")}</span>
                </Button>
              </Link>
              <UserMenu email={user.email} />
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
