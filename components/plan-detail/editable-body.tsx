"use client";

import { useRef, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InlineImageInserter } from "@/components/plan-detail/inline-image-inserter";
import { PolishImagesButton } from "@/components/plan-detail/polish-images-button";
import { updatePlanBody } from "@/lib/plan-actions";

export function EditableBody({
  planId,
  source,
  children,
}: {
  planId: string;
  source: string;
  /** El `<MarkdownBody>` ja resolt (server). Es mostra en read mode. */
  children: ReactNode;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // ID estable per al textarea perquè InlineImageInserter el trobi via getElementById.
  const textareaId = `body-edit-${planId}`;

  function save() {
    const value = textareaRef.current?.value ?? "";
    if (value.trim() === source.trim()) {
      setEditing(false);
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await updatePlanBody(planId, value);
        setEditing(false);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    });
  }

  function cancel() {
    setError(null);
    setEditing(false);
  }

  if (!editing) {
    return (
      <div className="group relative">
        <button
          type="button"
          onClick={() => setEditing(true)}
          aria-label="Editar cos del plan"
          className="absolute top-0 right-0 grid place-items-center h-11 w-11 -mt-1 -mr-1 opacity-60 sm:opacity-0 sm:group-hover:opacity-60 hover:!opacity-100 focus-visible:opacity-100 transition-opacity text-ink-soft z-10"
        >
          <Pencil className="h-4 w-4" strokeWidth={2} />
        </button>
        {children}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <span className="text-sm font-medium text-ink-soft">
          Editant el cos (Markdown)
        </span>
        <div className="flex items-center gap-4 flex-wrap">
          <PolishImagesButton planId={planId} textareaId={textareaId} />
          <InlineImageInserter planId={planId} textareaId={textareaId} />
        </div>
      </div>
      <textarea
        ref={textareaRef}
        id={textareaId}
        defaultValue={source}
        rows={20}
        autoFocus
        className="w-full px-4 py-3 rounded-md border border-ink-faint/60 bg-cream-soft text-ink font-mono text-base sm:text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-peach/40 focus:border-peach/40"
      />
      <div className="flex items-center gap-3">
        <Button onClick={save} disabled={pending} variant="primary" size="sm">
          {pending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />
              Desant…
            </>
          ) : (
            "Desar canvis"
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
