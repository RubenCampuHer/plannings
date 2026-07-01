"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUpRight, Check, ChevronRight } from "lucide-react";
import { toggleChecklistItem } from "@/lib/checklist-actions";

export type SubChecklistGroup = {
  planId: string;
  title: string;
  items: Array<{ id: string; text: string; done: boolean }>;
};

/**
 * Vista agregada de les "coses per fer" específiques de cada sub-plà, perquè al
 * pla pare es vegin totes en un sol lloc. Cada país es pot plegar (plegat per
 * defecte; capçalera amb títol + progrés sempre visible) i té una fletxa per
 * obrir el sub-plà. És interactiva: es poden marcar fetes des d'aquí (estat
 * optimista + `toggleChecklistItem`, que revalida el sub-plà). Els genèrics
 * viuen a la checklist pròpia del pla; aquí només els de cada país.
 */
export function SubChecklists({ groups }: { groups: SubChecklistGroup[] }) {
  const [state, setState] = useState(groups);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [, startTransition] = useTransition();

  // Sincronitza quan el server torna a carregar el pla pare.
  useEffect(() => {
    setState(groups);
  }, [groups]);

  function toggleOpen(planId: string) {
    setOpen((prev) => ({ ...prev, [planId]: !prev[planId] }));
  }

  function toggle(planId: string, itemId: string, current: boolean) {
    const newDone = !current;
    setState((prev) =>
      prev.map((g) =>
        g.planId === planId
          ? {
              ...g,
              items: g.items.map((i) =>
                i.id === itemId ? { ...i, done: newDone } : i,
              ),
            }
          : g,
      ),
    );
    startTransition(async () => {
      try {
        await toggleChecklistItem(planId, itemId, newDone);
      } catch {
        // Reverteix l'optimisme si falla.
        setState((prev) =>
          prev.map((g) =>
            g.planId === planId
              ? {
                  ...g,
                  items: g.items.map((i) =>
                    i.id === itemId ? { ...i, done: current } : i,
                  ),
                }
              : g,
          ),
        );
      }
    });
  }

  const withItems = state.filter((g) => g.items.length > 0);
  if (withItems.length === 0) return null;

  return (
    <section aria-label="Per fer a cada país">
      <h3 className="font-hand text-lg text-peach-deep -rotate-1 inline-block mb-2">
        per fer a cada país
      </h3>
      <div className="space-y-4">
        {withItems.map((g) => {
          const done = g.items.filter((i) => i.done).length;
          const pct = Math.round((done / g.items.length) * 100);
          const isOpen = open[g.planId] ?? false;
          // Pendents a dalt, fets al fons (esvaïts).
          const ordered = [...g.items].sort(
            (a, b) => Number(a.done) - Number(b.done),
          );
          return (
            <div key={g.planId}>
              <div className="flex items-center gap-2 mb-1">
                <button
                  type="button"
                  onClick={() => toggleOpen(g.planId)}
                  aria-expanded={isOpen}
                  className="group flex items-center gap-1 min-w-0 flex-1 text-left"
                >
                  <ChevronRight
                    className={`h-3.5 w-3.5 shrink-0 text-ink-soft transition-transform ${
                      isOpen ? "rotate-90" : ""
                    }`}
                    strokeWidth={2}
                  />
                  <span className="text-sm font-medium text-ink truncate">
                    {g.title}
                  </span>
                  <span className="ml-auto pl-2 text-xs text-ink-soft tabular-nums shrink-0">
                    {done}/{g.items.length}
                  </span>
                </button>
                <Link
                  href={`/plans/${g.planId}`}
                  aria-label={`Obrir ${g.title}`}
                  className="shrink-0 text-ink-soft hover:text-peach-deep transition-colors"
                >
                  <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={2} />
                </Link>
              </div>
              <div
                className="h-1 w-full rounded-full bg-ink-faint/15 overflow-hidden"
                role="progressbar"
                aria-valuenow={pct}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`${g.title}: ${done} de ${g.items.length} fetes`}
              >
                <motion.div
                  className="h-full rounded-full bg-sage-deep"
                  initial={false}
                  animate={{ width: `${pct}%` }}
                  transition={{ type: "spring", stiffness: 220, damping: 30 }}
                />
              </div>
              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.ul
                    key="items"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-1 pl-0.5 mt-2 overflow-hidden"
                  >
                    {ordered.map((i) => (
                      <motion.li
                        key={i.id}
                        layout
                        transition={{ type: "spring", stiffness: 500, damping: 34 }}
                        className="flex items-start gap-2 text-sm"
                      >
                        <button
                          type="button"
                          onClick={() => toggle(g.planId, i.id, i.done)}
                          aria-pressed={i.done}
                          aria-label={
                            i.done ? `Desfer: ${i.text}` : `Marcar fet: ${i.text}`
                          }
                          className={`mt-0.5 grid place-items-center h-4 w-4 shrink-0 rounded border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-peach/50 ${
                            i.done
                              ? "bg-sage-deep border-sage-deep text-white"
                              : "bg-cream border-ink-faint/60 hover:border-sage-deep"
                          }`}
                        >
                          {i.done && <Check className="h-2.5 w-2.5" strokeWidth={3} />}
                        </button>
                        <span
                          className={
                            i.done
                              ? "text-ink-soft/75 line-through decoration-ink-soft/40"
                              : "text-ink-soft"
                          }
                        >
                          {i.text}
                        </span>
                      </motion.li>
                    ))}
                  </motion.ul>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </section>
  );
}
