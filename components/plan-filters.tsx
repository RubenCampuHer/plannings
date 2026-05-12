"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Search } from "lucide-react";
import { Chip } from "@/components/ui/chip";
import { PlanCard } from "@/components/plan-card";
import { EmptyState } from "@/components/empty-state";
import type { Plan, PlanStatus, PlanType } from "@/lib/types";

export type FilterQuery = {
  type: PlanType | "all";
  status: PlanStatus | "all";
  q: string;
};

const TYPES: { value: PlanType | "all"; label: string }[] = [
  { value: "all", label: "Tots" },
  { value: "deep", label: "Viatges llargs" },
  { value: "weekend", label: "Escapades" },
  { value: "day", label: "Dies" },
];

const STATUSES: { value: PlanStatus | "all"; label: string }[] = [
  { value: "all", label: "Tots" },
  { value: "planning", label: "Planificant" },
  { value: "active", label: "En curs" },
  { value: "completed", label: "Viscuts" },
];

export function PlanFilters({
  plans,
  currentQuery,
}: {
  plans: Plan[];
  currentQuery: FilterQuery;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const [localQ, setLocalQ] = useState(currentQuery.q);
  const [prevUrlQ, setPrevUrlQ] = useState(currentQuery.q);

  // Resync local search input when the URL changes externally (back/forward, deep links).
  // React's "adjust state during render" pattern — preferable to a useEffect here.
  if (currentQuery.q !== prevUrlQ) {
    setPrevUrlQ(currentQuery.q);
    setLocalQ(currentQuery.q);
  }

  function pushQuery(next: Partial<FilterQuery>) {
    const merged = { ...currentQuery, ...next };
    const params = new URLSearchParams();
    if (merged.type !== "all") params.set("type", merged.type);
    if (merged.status !== "all") params.set("status", merged.status);
    if (merged.q) params.set("q", merged.q);
    const qs = params.toString();
    startTransition(() => {
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    });
  }

  // Debounce text search so we don't refetch on every keystroke.
  useEffect(() => {
    if (localQ === currentQuery.q) return;
    const t = setTimeout(() => pushQuery({ q: localQ }), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localQ]);

  const hasFilters =
    currentQuery.type !== "all" ||
    currentQuery.status !== "all" ||
    currentQuery.q.length > 0;

  function clearAll() {
    setLocalQ("");
    startTransition(() => router.replace(pathname, { scroll: false }));
  }

  return (
    <div className="space-y-8">
      <div className="space-y-4" aria-busy={pending}>
        <div className="relative max-w-md">
          <Search
            className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-soft"
            strokeWidth={2}
          />
          <input
            type="search"
            value={localQ}
            onChange={(e) => setLocalQ(e.target.value)}
            placeholder="Cerca un plan…"
            aria-label="Cerca per títol, destí o resum"
            className="w-full h-11 pl-10 pr-4 bg-cream-soft border border-ink-faint/50 rounded-full text-sm placeholder:text-ink-soft/70 focus:outline-none focus:border-peach focus:ring-4 focus:ring-peach/15 transition-all"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs uppercase tracking-wider text-ink-soft mr-1">Tipus</span>
          {TYPES.map((t) => (
            <Chip
              key={t.value}
              active={currentQuery.type === t.value}
              onClick={() => pushQuery({ type: t.value })}
              tone="peach"
            >
              {t.label}
            </Chip>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs uppercase tracking-wider text-ink-soft mr-1">Estat</span>
          {STATUSES.map((s) => (
            <Chip
              key={s.value}
              active={currentQuery.status === s.value}
              onClick={() => pushQuery({ status: s.value })}
              tone="sage"
            >
              {s.label}
            </Chip>
          ))}
        </div>
      </div>

      {plans.length === 0 ? (
        <EmptyState
          title="Encara no hi ha res aquí"
          subtitle={
            hasFilters
              ? "Ajusta els filtres o esborra'ls del tot."
              : "Quan afegiu el primer plan, apareixerà aquí."
          }
          action={
            hasFilters
              ? { label: "Esborra els filtres", onClick: clearAll }
              : undefined
          }
        />
      ) : (
        <motion.div
          // `key` lligat al conjunt de plans perquè quan canviï la URL (filtre), l'animació es torni a disparar suau.
          key={plans.map((p) => p.id).join(",")}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
          initial="hidden"
          animate="visible"
          variants={{
            hidden: {},
            visible: { transition: { staggerChildren: 0.04 } },
          }}
        >
          {plans.map((p) => (
            <motion.div
              key={p.id}
              variants={{
                hidden: { opacity: 0, y: 12 },
                visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: "easeOut" } },
              }}
            >
              <PlanCard plan={p} />
            </motion.div>
          ))}
        </motion.div>
      )}
    </div>
  );
}
