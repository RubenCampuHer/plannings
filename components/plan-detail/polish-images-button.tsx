"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Camera, Check, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { polishImagesWithAi, type ImagePolishResult } from "@/lib/ai-actions";

/**
 * Botó de "Polish imatges amb IA": una passada que pregunta a Gemini quines
 * fotos il·lustrarien el plan, en busca cadascuna a Pexels, les puja al bucket,
 * les insereix inline al body i les afegeix a l'Àlbum.
 *
 * És un sol click, sense panell de tria — l'usuari pot esborrar a posteriori
 * les que no encaixin. Si M7 madura, podem afegir el panell de tria a M7.2.
 */
export function PolishImagesButton({ planId }: { planId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ImagePolishResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  function run() {
    const ok = window.confirm(
      "Generaré unes quantes imatges amb IA + Pexels i les afegiré al plan (inline al body + Àlbum). Pot trigar ~15-25 segons.\n\nContinuar?",
    );
    if (!ok) return;
    setError(null);
    setResult(null);
    startTransition(async () => {
      try {
        const r = await polishImagesWithAi(planId);
        setResult(r);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    });
  }

  // ---------- Result ----------
  if (result) {
    return (
      <div className="rounded-lg border border-sage-deep/30 bg-sage-soft/30 p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Check className="h-5 w-5 text-sage-deep" strokeWidth={2.5} />
          <p className="font-medium text-ink">
            {result.added > 0 ? "Imatges afegides" : "Sense canvis"}
          </p>
        </div>
        <ul className="text-sm text-ink-soft space-y-1 ml-7 list-disc list-outside">
          {result.added > 0 && (
            <li>
              {result.added}{" "}
              {result.added === 1 ? "imatge inserida" : "imatges inserides"} al body i a
              l&apos;Àlbum. Mira el plan per veure-les.
            </li>
          )}
          {result.failed.length > 0 && (
            <li className="text-peach-deep">
              Pexels no ha trobat res per: {result.failed.join(", ")}
            </li>
          )}
        </ul>
        <Button variant="ghost" size="sm" onClick={() => setResult(null)}>
          Tornar a començar
        </Button>
      </div>
    );
  }

  // ---------- Idle / loading ----------
  return (
    <div className="rounded-lg border border-sage-deep/30 bg-gradient-to-br from-sage-soft/40 to-cream-soft p-5">
      <div className="flex items-start gap-4">
        <span className="grid place-items-center h-11 w-11 shrink-0 rounded-full bg-sage-deep text-white shadow-[0_2px_0_0_rgba(123,151,113,0.25)]">
          <Camera className="h-5 w-5" strokeWidth={2.25} />
        </span>
        <div className="flex-1">
          <h2 className="font-serif text-xl font-semibold text-ink mb-1">
            Polish imatges amb IA
          </h2>
          <p className="text-sm text-ink-soft mb-4">
            Una sola passada: la IA llegeix el plan, busca fotos a Pexels i les insereix
            al body i a l&apos;Àlbum. Pots esborrar després les que no t&apos;agradin.
          </p>
          <Button onClick={run} disabled={pending} variant="primary">
            {pending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />
                Generant imatges… (~20s)
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" strokeWidth={2} />
                Polish imatges amb IA
              </>
            )}
          </Button>
          {error && <p className="mt-3 text-sm text-peach-deep">{error}</p>}
        </div>
      </div>
    </div>
  );
}
