"use client";

import { useEffect, useRef } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";

/**
 * Diàleg de confirmació coherent amb la paleta càlida, en substitució dels
 * `window.confirm()` natius (lletjos i, dins de modals a iOS, poc fiables).
 * Bottom-sheet a mòbil (items-end + safe-area) i centrat a desktop.
 *
 * Controlat: el consumidor manté `open` i les accions; `onConfirm` pot ser
 * async (el botó mostra spinner via `busy`).
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancel·lar",
  destructive = false,
  busy = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    confirmRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !busy) onCancel();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, busy, onCancel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-ink/40 backdrop-blur-sm p-0 sm:p-6"
      onClick={() => {
        if (!busy) onCancel();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-sm bg-cream rounded-t-2xl sm:rounded-2xl border border-ink-faint/40 shadow-[0_-12px_40px_-12px_rgba(58,46,42,0.4)] sm:shadow-[0_24px_48px_-12px_rgba(58,46,42,0.3)] p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:pb-5 space-y-4 animate-in slide-in-from-bottom sm:zoom-in-95 duration-200"
      >
        <div className="flex items-start gap-3">
          <span
            className={`grid place-items-center h-10 w-10 shrink-0 rounded-full ${
              destructive ? "bg-peach-soft/60 text-peach-deep" : "bg-cream-deep text-ink-soft"
            }`}
          >
            <AlertTriangle className="h-5 w-5" strokeWidth={2} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="font-serif text-lg font-semibold text-ink">{title}</h2>
            {description && (
              <div className="text-sm text-ink-soft mt-1 leading-relaxed">
                {description}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="min-h-[44px] px-4 rounded-[var(--radius-button)] text-sm font-medium text-ink-soft hover:text-ink hover:bg-cream-deep/60 disabled:opacity-50 transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={`min-h-[44px] px-4 inline-flex items-center justify-center gap-2 rounded-[var(--radius-button)] text-sm font-medium text-white disabled:opacity-50 transition-colors ${
              destructive ? "bg-peach-deep hover:bg-peach" : "bg-ink hover:bg-ink/90"
            }`}
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
