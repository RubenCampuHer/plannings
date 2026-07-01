"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronRight } from "lucide-react";

/**
 * Targeta de sidebar plegable. La capçalera (títol + resum) sempre és visible;
 * el cos es pot plegar. `defaultCollapsed` la deixa tancada d'entrada (p. ex.
 * quan el bloc és llarg), però sempre es pot obrir/tancar manualment.
 */
export function CollapsibleCard({
  title,
  summary,
  defaultCollapsed = false,
  children,
}: {
  title: string;
  summary?: React.ReactNode;
  defaultCollapsed?: boolean;
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  return (
    <section className="rounded-[var(--radius-card)] bg-cream-soft/70 border border-ink-faint/30 p-6">
      <button
        type="button"
        onClick={() => setCollapsed((v) => !v)}
        aria-expanded={!collapsed}
        className="w-full flex items-baseline justify-between gap-2 text-left"
      >
        <span className="flex items-baseline gap-1.5 min-w-0">
          <ChevronRight
            className={`h-4 w-4 self-center shrink-0 text-ink-soft transition-transform ${
              collapsed ? "" : "rotate-90"
            }`}
            strokeWidth={2}
          />
          <h2 className="font-serif text-lg font-semibold truncate">{title}</h2>
        </span>
        {summary && <span className="shrink-0">{summary}</span>}
      </button>

      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.div
            key="body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="pt-4">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
