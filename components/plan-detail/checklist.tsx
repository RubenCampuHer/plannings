"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check } from "lucide-react";
import { formatShortDate } from "@/lib/format";
import type { ChecklistItem } from "@/lib/types";

export function Checklist({ items }: { items: ChecklistItem[] }) {
  // Estat local optimista. A M2 substituirem aquest setItems per una mutació a Supabase.
  const [list, setList] = useState(items);
  if (list.length === 0) return null;
  const remaining = list.filter((i) => !i.done).length;

  function toggle(id: string) {
    setList((prev) =>
      prev.map((it) => (it.id === id ? { ...it, done: !it.done } : it)),
    );
  }

  return (
    <section className="rounded-[var(--radius-card)] bg-cream-soft/70 border border-ink-faint/30 p-6">
      <header className="flex items-baseline justify-between mb-4">
        <h2 className="font-serif text-lg font-semibold">Per fer</h2>
        <span className="font-hand text-base text-ink-soft -rotate-1">
          {remaining === 0 ? "tot fet ✨" : `${remaining} pendents`}
        </span>
      </header>
      <ul className="space-y-2.5">
        {list.map((item) => (
          <li key={item.id} className="flex items-start gap-3 text-sm">
            <button
              type="button"
              onClick={() => toggle(item.id)}
              aria-pressed={item.done}
              aria-label={item.done ? `Desfer: ${item.text}` : `Marcar fet: ${item.text}`}
              className={`mt-0.5 grid place-items-center h-5 w-5 rounded-md border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-peach/50 focus-visible:ring-offset-1 focus-visible:ring-offset-cream-soft ${
                item.done
                  ? "bg-sage-deep border-sage-deep text-white"
                  : "bg-cream border-ink-faint/60 hover:border-sage-deep"
              }`}
            >
              <AnimatePresence>
                {item.done && (
                  <motion.span
                    key="check"
                    initial={{ scale: 0, rotate: -20 }}
                    animate={{ scale: 1, rotate: 0 }}
                    exit={{ scale: 0, opacity: 0 }}
                    transition={{ type: "spring", stiffness: 500, damping: 24 }}
                  >
                    <Check className="h-3 w-3" strokeWidth={3} />
                  </motion.span>
                )}
              </AnimatePresence>
            </button>
            <motion.span
              animate={{
                color: item.done ? "var(--color-ink-soft)" : "var(--color-ink)",
                opacity: item.done ? 0.75 : 1,
              }}
              transition={{ duration: 0.2 }}
              className={`flex-1 leading-relaxed ${
                item.done ? "line-through decoration-ink-soft/50" : ""
              }`}
            >
              {item.text}
              {item.dueDate && !item.done && (
                <span className="ml-2 text-xs text-peach-deep">
                  {formatShortDate(item.dueDate)}
                </span>
              )}
            </motion.span>
          </li>
        ))}
      </ul>
    </section>
  );
}
