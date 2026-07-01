"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronRight } from "lucide-react";
import { toggleChecklistItem } from "@/lib/checklist-actions";

export type SubChecklistGroup = {
  planId: string;
  title: string;
  items: Array<{ id: string; text: string; done: boolean }>;
};

/**
 * Vista agregada de les "coses per fer" específiques de cada sub-plà, perquè al
 * pla pare es vegin totes en un sol lloc. Ara és interactiva: es poden marcar
 * fetes des d'aquí (estat optimista + `toggleChecklistItem`, que revalida el
 * sub-plà). L'enllaç de la capçalera segueix portant a editar el sub-plà. Els
 * genèrics viuen a la checklist pròpia del pla; aquí només els de cada país.
 */
export function SubChecklists({ groups }: { groups: SubChecklistGroup[] }) {
  const [state, setState] = useState(groups);
  const [, startTransition] = useTransition();

  // Sincronitza quan el server torna a carregar el pla pare.
  useEffect(() => {
    setState(groups);
  }, [groups]);

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
          // Pendents a dalt, fets al fons (esvaïts).
          const ordered = [...g.items].sort(
            (a, b) => Number(a.done) - Number(b.done),
          );
          return (
            <div key={g.planId}>
              <Link
                href={`/plans/${g.planId}`}
                className="group flex items-baseline justify-between gap-2 mb-1"
              >
                <span className="text-sm font-medium text-ink group-hover:text-peach-deep inline-flex items-center gap-0.5 min-w-0">
                  <span className="truncate">{g.title}</span>
                  <ChevronRight
                    className="h-3.5 w-3.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                    strokeWidth={2}
                  />
                </span>
                <span className="text-xs text-ink-soft tabular-nums shrink-0">
                  {done}/{g.items.length}
                </span>
              </Link>
              <div
                className="h-1 w-full rounded-full bg-ink-faint/15 overflow-hidden mb-2"
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
              <ul className="space-y-1 pl-0.5">
                <AnimatePresence initial={false}>
                  {ordered.map((i) => (
                    <motion.li
                      key={i.id}
                      layout
                      transition={{ type: "spring", stiffness: 500, damping: 34 }}
                      className="group/item flex items-start gap-2 text-sm"
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
                </AnimatePresence>
              </ul>
            </div>
          );
        })}
      </div>
    </section>
  );
}
