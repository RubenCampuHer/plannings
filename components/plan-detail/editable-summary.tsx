"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { updatePlanSummary } from "@/lib/plan-actions";

export function EditableSummary({
  planId,
  value,
}: {
  planId: string;
  value: string;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function save() {
    if (draft.trim() === value.trim()) {
      setEditing(false);
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await updatePlanSummary(planId, draft);
        setEditing(false);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    });
  }

  function cancel() {
    setDraft(value);
    setError(null);
    setEditing(false);
  }

  if (!editing) {
    return (
      <div className="group relative mb-8">
        <p className="font-serif text-xl italic text-ink-soft leading-relaxed pr-10">
          {value}
        </p>
        <button
          type="button"
          onClick={() => setEditing(true)}
          aria-label="Editar resum"
          className="absolute top-0 right-0 grid place-items-center h-11 w-11 -mt-1 -mr-1 opacity-60 sm:opacity-0 sm:group-hover:opacity-60 hover:!opacity-100 focus-visible:opacity-100 transition-opacity text-ink-soft"
        >
          <Pencil className="h-4 w-4" strokeWidth={2} />
        </button>
      </div>
    );
  }

  return (
    <div className="mb-8 space-y-2">
      <textarea
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        rows={3}
        className="w-full px-4 py-3 rounded-md border border-ink-faint/60 bg-cream-soft text-ink font-serif text-xl italic leading-relaxed focus:outline-none focus:ring-2 focus:ring-peach/40 focus:border-peach/40"
      />
      <div className="flex items-center gap-3">
        <Button onClick={save} disabled={pending} variant="primary" size="sm">
          {pending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />
              Desant…
            </>
          ) : (
            "Desar"
          )}
        </Button>
        <button
          type="button"
          onClick={cancel}
          disabled={pending}
          className="text-sm text-ink-soft hover:text-ink"
        >
          Cancel·lar
        </button>
        {error && <span className="text-sm text-peach-deep">{error}</span>}
      </div>
    </div>
  );
}
