"use client";

import { useState } from "react";
import {
  Check,
  FileText,
  ListTodo,
  Loader2,
  MapPin,
  Sparkles,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  addAiChecklistItems,
  applyAiPlaceSuggestions,
  polishWithAi,
  type PolishSuggestions,
} from "@/lib/ai-actions";

type ApplyResult = {
  bodyInjected: boolean;
  placesAdded: number;
  placesFailed: string[];
  checklistAdded: number;
};

export function PolishWithAi({ planId }: { planId: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<PolishSuggestions | null>(null);
  const [acceptBody, setAcceptBody] = useState(true);
  const [acceptedPlaces, setAcceptedPlaces] = useState<Set<number>>(new Set());
  const [acceptedChecklist, setAcceptedChecklist] = useState<Set<number>>(new Set());
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState<ApplyResult | null>(null);

  async function fetchSuggestions() {
    setLoading(true);
    setError(null);
    setApplied(null);
    setSuggestions(null);
    try {
      const result = await polishWithAi(planId);
      setSuggestions(result);
      setAcceptBody(true);
      setAcceptedPlaces(new Set(result.suggestedPlaces.map((_, i) => i)));
      setAcceptedChecklist(new Set(result.suggestedChecklist.map((_, i) => i)));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  function togglePlace(i: number) {
    setAcceptedPlaces((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  function toggleChecklist(i: number) {
    setAcceptedChecklist((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  async function apply() {
    if (!suggestions) return;
    setApplying(true);
    setError(null);
    try {
      const placesToAdd = Array.from(acceptedPlaces).map(
        (i) => suggestions.suggestedPlaces[i],
      );
      const checklistTexts = Array.from(acceptedChecklist).map(
        (i) => suggestions.suggestedChecklist[i].text,
      );

      // El cos no es persisteix aquí — només s'injecta al textarea del form.
      // L'usuari ha de clicar "Desar canvis" del formulari per guardar-lo.
      let bodyInjected = false;
      if (acceptBody) {
        const ta = document.getElementById("body") as HTMLTextAreaElement | null;
        if (ta) {
          ta.value = suggestions.enrichedBody;
          ta.dispatchEvent(new Event("input", { bubbles: true }));
          ta.scrollIntoView({ behavior: "smooth", block: "center" });
          bodyInjected = true;
        }
      }

      const [placesResult] = await Promise.all([
        placesToAdd.length > 0
          ? applyAiPlaceSuggestions(planId, placesToAdd)
          : Promise.resolve({ added: 0, failed: [] as string[] }),
        checklistTexts.length > 0
          ? addAiChecklistItems(planId, checklistTexts)
          : Promise.resolve(),
      ]);

      const places = placesResult as { added: number; failed: string[] };

      setApplied({
        bodyInjected,
        placesAdded: places.added,
        placesFailed: places.failed,
        checklistAdded: checklistTexts.length,
      });
      setSuggestions(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setApplying(false);
    }
  }

  // ---------- View 1: success summary ----------
  if (applied) {
    return (
      <div className="rounded-lg border border-sage-deep/30 bg-sage-soft/30 p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Check className="h-5 w-5 text-sage-deep" strokeWidth={2.5} />
          <p className="font-medium text-ink">Aplicat</p>
        </div>
        <ul className="text-sm text-ink-soft space-y-1 ml-7 list-disc list-outside">
          {applied.bodyInjected && (
            <li>
              Cos del plan injectat al formulari —{" "}
              <strong className="text-ink">clica "Desar canvis"</strong> per guardar-lo.
            </li>
          )}
          {applied.placesAdded > 0 && (
            <li>
              {applied.placesAdded} {applied.placesAdded === 1 ? "lloc afegit" : "llocs afegits"} al mapa
            </li>
          )}
          {applied.placesFailed.length > 0 && (
            <li className="text-peach-deep">
              No s'han trobat coordenades per: {applied.placesFailed.join(", ")}
            </li>
          )}
          {applied.checklistAdded > 0 && (
            <li>
              {applied.checklistAdded} {applied.checklistAdded === 1 ? "item" : "items"} afegits a la checklist
            </li>
          )}
        </ul>
        <Button variant="ghost" size="sm" onClick={() => setApplied(null)}>
          Tornar a començar
        </Button>
      </div>
    );
  }

  // ---------- View 2: initial button (no suggestions yet) ----------
  if (!suggestions) {
    return (
      <div className="rounded-lg border border-peach/30 bg-gradient-to-br from-peach-soft/30 to-cream-soft p-5">
        <div className="flex items-start gap-4">
          <span className="grid place-items-center h-11 w-11 shrink-0 rounded-full bg-peach text-white shadow-[0_2px_0_0_rgba(226,122,69,0.25)]">
            <Sparkles className="h-5 w-5" strokeWidth={2.25} />
          </span>
          <div className="flex-1">
            <h2 className="font-serif text-xl font-semibold text-ink mb-1">
              Polish amb IA
            </h2>
            <p className="text-sm text-ink-soft mb-4">
              Demana a la IA que enriqueixi el cos, suggereixi llocs per al mapa i
              items per a la checklist. Tu tries què acceptes.
            </p>
            <Button onClick={fetchSuggestions} disabled={loading} variant="primary">
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />
                  Pensant…
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" strokeWidth={2} />
                  Polish amb IA
                </>
              )}
            </Button>
            {error && (
              <p className="mt-3 text-sm text-peach-deep">{error}</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ---------- View 3: suggestions to review ----------
  const totalSelected =
    (acceptBody ? 1 : 0) + acceptedPlaces.size + acceptedChecklist.size;

  return (
    <div className="rounded-lg border border-peach/30 bg-cream-soft p-6 space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-serif text-xl font-semibold text-ink flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-peach-deep" strokeWidth={2.25} />
            Suggeriments de la IA
          </h2>
          <p className="text-sm text-ink-soft mt-1">
            Marca el que vulguis aplicar i clica "Aplicar selecció".
          </p>
        </div>
        <button
          type="button"
          onClick={() => setSuggestions(null)}
          className="text-ink-soft hover:text-ink"
          aria-label="Tancar"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Body */}
      <section className="space-y-2">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={acceptBody}
            onChange={(e) => setAcceptBody(e.target.checked)}
            className="h-4 w-4 accent-peach"
          />
          <FileText className="h-4 w-4 text-ink-soft" strokeWidth={2} />
          <span className="font-medium text-ink">Reemplaçar cos del plan</span>
        </label>
        <pre className="ml-6 max-h-72 overflow-auto rounded-md border border-ink-faint/30 bg-cream p-3 text-xs font-mono text-ink whitespace-pre-wrap">
          {suggestions.enrichedBody}
        </pre>
      </section>

      {/* Places */}
      {suggestions.suggestedPlaces.length > 0 && (
        <section className="space-y-3">
          <h3 className="font-medium text-ink flex items-center gap-2">
            <MapPin className="h-4 w-4 text-ink-soft" strokeWidth={2} />
            Llocs suggerits ({acceptedPlaces.size}/{suggestions.suggestedPlaces.length})
          </h3>
          <ul className="space-y-1.5">
            {suggestions.suggestedPlaces.map((p, i) => (
              <li key={i}>
                <label className="flex items-start gap-2 px-3 py-2 rounded-md border border-ink-faint/30 hover:bg-peach-soft/20 cursor-pointer transition-colors">
                  <input
                    type="checkbox"
                    checked={acceptedPlaces.has(i)}
                    onChange={() => togglePlace(i)}
                    className="h-4 w-4 mt-0.5 accent-peach"
                  />
                  <span className="flex-1 min-w-0">
                    <span className="block font-medium text-ink">{p.name}</span>
                    <span className="block text-xs text-ink-soft font-mono">
                      🔍 {p.searchQuery}
                    </span>
                    {p.why && (
                      <span className="block text-xs text-ink-soft italic mt-0.5">
                        {p.why}
                      </span>
                    )}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Checklist */}
      {suggestions.suggestedChecklist.length > 0 && (
        <section className="space-y-3">
          <h3 className="font-medium text-ink flex items-center gap-2">
            <ListTodo className="h-4 w-4 text-ink-soft" strokeWidth={2} />
            Items de checklist ({acceptedChecklist.size}/{suggestions.suggestedChecklist.length})
          </h3>
          <ul className="space-y-1">
            {suggestions.suggestedChecklist.map((c, i) => (
              <li key={i}>
                <label className="flex items-center gap-2 px-3 py-2 rounded-md border border-ink-faint/30 hover:bg-peach-soft/20 cursor-pointer transition-colors">
                  <input
                    type="checkbox"
                    checked={acceptedChecklist.has(i)}
                    onChange={() => toggleChecklist(i)}
                    className="h-4 w-4 accent-peach"
                  />
                  <span className="text-sm text-ink">{c.text}</span>
                </label>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="flex items-center gap-3 pt-4 border-t border-ink-faint/30">
        <Button onClick={apply} disabled={applying || totalSelected === 0} variant="primary">
          {applying ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />
              Aplicant…
            </>
          ) : (
            <>
              <Check className="h-4 w-4" strokeWidth={2} />
              Aplicar selecció ({totalSelected})
            </>
          )}
        </Button>
        <button
          type="button"
          onClick={() => setSuggestions(null)}
          className="text-sm text-ink-soft hover:text-ink"
        >
          Cancel·lar
        </button>
        {error && <p className="ml-auto text-sm text-peach-deep">{error}</p>}
      </div>

      <p className="text-xs text-ink-soft pt-1">
        Nota: el cos s'injecta al formulari de dalt — pots revisar-lo i editar-lo
        abans de clicar "Desar canvis". Els llocs i items de checklist sí que
        s'apliquen al moment (es poden esborrar després).
      </p>
    </div>
  );
}
