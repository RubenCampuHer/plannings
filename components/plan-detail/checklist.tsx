"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronRight, Plus, Trash2 } from "lucide-react";
import {
  addChecklistItem,
  deleteChecklistItem,
  toggleChecklistItem,
} from "@/lib/checklist-actions";
import { formatShortDate } from "@/lib/format";
import type { ChecklistItem } from "@/lib/types";

export function Checklist({
  planId,
  items,
  children,
}: {
  planId: string;
  items: ChecklistItem[];
  // Sub-secció opcional dins la mateixa targeta (p. ex. "per fer a cada país").
  children?: React.ReactNode;
}) {
  const [list, setList] = useState(items);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [showDone, setShowDone] = useState(false);
  const [, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  // Sincronitza amb els props quan el server re-renderitza després d'un revalidatePath.
  useEffect(() => {
    setList(items);
  }, [items]);

  // Els pendents pugen a dalt; els fets baixen i es pleguen.
  const pending = list.filter((i) => !i.done);
  const done = list.filter((i) => i.done);
  const remaining = pending.length;
  const pct = list.length === 0 ? 0 : Math.round((done.length / list.length) * 100);

  function toggle(id: string) {
    const current = list.find((i) => i.id === id);
    if (!current) return;
    const newDone = !current.done;
    setList((prev) => prev.map((it) => (it.id === id ? { ...it, done: newDone } : it)));
    startTransition(async () => {
      try {
        await toggleChecklistItem(planId, id, newDone);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        setList((prev) =>
          prev.map((it) => (it.id === id ? { ...it, done: !newDone } : it)),
        );
      }
    });
  }

  function remove(id: string) {
    const snapshot = list;
    setList((prev) => prev.filter((it) => it.id !== id));
    startTransition(async () => {
      try {
        await deleteChecklistItem(planId, id);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        setList(snapshot);
      }
    });
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    setError(null);
    // ID temporal optimista — quan revalidatePath sincronitzi, el real el substituirà.
    const tempId = `tmp-${crypto.randomUUID()}`;
    setList((prev) => [...prev, { id: tempId, text, done: false }]);
    setDraft("");
    startTransition(async () => {
      try {
        await addChecklistItem(planId, text);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        setList((prev) => prev.filter((it) => it.id !== tempId));
        setDraft(text);
        inputRef.current?.focus();
      }
    });
  }

  function renderItem(item: ChecklistItem) {
    return (
      <motion.li
        key={item.id}
        layout
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, height: 0 }}
        transition={{ type: "spring", stiffness: 500, damping: 34 }}
        className="group flex items-start gap-3 text-sm"
      >
        <button
          type="button"
          onClick={() => toggle(item.id)}
          aria-pressed={item.done}
          aria-label={item.done ? `Desfer: ${item.text}` : `Marcar fet: ${item.text}`}
          className={`mt-0.5 grid place-items-center h-5 w-5 shrink-0 rounded-md border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-peach/50 focus-visible:ring-offset-1 focus-visible:ring-offset-cream-soft ${
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
          className={`flex-1 min-w-0 leading-relaxed break-words ${
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
        <button
          type="button"
          onClick={() => remove(item.id)}
          aria-label={`Esborrar: ${item.text}`}
          className="shrink-0 mt-0.5 opacity-0 group-hover:opacity-60 hover:!opacity-100 focus-visible:opacity-100 transition-opacity text-ink-soft hover:text-peach-deep"
        >
          <Trash2 className="h-4 w-4" strokeWidth={1.75} />
        </button>
      </motion.li>
    );
  }

  return (
    <section className="rounded-[var(--radius-card)] bg-cream-soft/70 border border-ink-faint/30 p-6">
      <header className="flex items-baseline justify-between mb-3">
        <h2 className="font-serif text-lg font-semibold">Per fer</h2>
        <span className="font-hand text-base text-ink-soft -rotate-1">
          {list.length === 0
            ? "buit"
            : remaining === 0
              ? "tot fet ✨"
              : `${remaining} pendents`}
        </span>
      </header>

      {list.length > 0 && (
        <div
          className="h-1.5 w-full rounded-full bg-ink-faint/15 overflow-hidden mb-4"
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${done.length} de ${list.length} fetes`}
        >
          <motion.div
            className="h-full rounded-full bg-sage-deep"
            initial={false}
            animate={{ width: `${pct}%` }}
            transition={{ type: "spring", stiffness: 220, damping: 30 }}
          />
        </div>
      )}

      {pending.length > 0 && (
        <ul className="space-y-2.5 mb-3">
          <AnimatePresence initial={false}>
            {pending.map(renderItem)}
          </AnimatePresence>
        </ul>
      )}

      {done.length > 0 && (
        <div className="mb-3">
          <button
            type="button"
            onClick={() => setShowDone((v) => !v)}
            aria-expanded={showDone}
            className="flex items-center gap-1 text-xs text-ink-soft hover:text-ink transition-colors"
          >
            <ChevronRight
              className={`h-3.5 w-3.5 transition-transform ${showDone ? "rotate-90" : ""}`}
              strokeWidth={2}
            />
            {done.length} {done.length === 1 ? "feta" : "fetes"}
          </button>
          <AnimatePresence initial={false}>
            {showDone && (
              <motion.ul
                key="done-list"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="space-y-2.5 mt-2.5 overflow-hidden"
              >
                {done.map(renderItem)}
              </motion.ul>
            )}
          </AnimatePresence>
        </div>
      )}

      <form onSubmit={add} className="flex items-center gap-2">
        <input
          ref={inputRef}
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Afegir un pendent…"
          className="flex-1 h-9 px-3 rounded-md border border-ink-faint/50 bg-cream text-sm text-ink placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-peach/40 focus:border-peach/40"
        />
        <button
          type="submit"
          disabled={draft.trim().length === 0}
          aria-label="Afegir item"
          className="grid place-items-center h-9 w-9 rounded-md bg-peach text-white shadow-[0_1px_0_0_rgba(226,122,69,0.25)] hover:bg-peach-deep disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <Plus className="h-4 w-4" strokeWidth={2.5} />
        </button>
      </form>

      {error && <p className="mt-2 text-xs text-peach-deep">{error}</p>}

      {children && (
        <div className="mt-5 pt-5 border-t border-ink-faint/25">{children}</div>
      )}
    </section>
  );
}
