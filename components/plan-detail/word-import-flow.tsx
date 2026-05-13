"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  FileText,
  Layers,
  ListTodo,
  Loader2,
  MapPin,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  analyzeWordDocument,
  createPlansFromAnalysis,
  type WordAnalysis,
} from "@/lib/word-import-actions";

export function WordImportFlow() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<WordAnalysis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [creating, startCreating] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setAnalysis(null);
    setError(null);
    setAnalyzing(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const result = await analyzeWordDocument(fd);
      setAnalysis(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setAnalyzing(false);
      e.target.value = "";
    }
  }

  function create() {
    if (!analysis) return;
    setError(null);
    startCreating(async () => {
      try {
        const { parentId } = await createPlansFromAnalysis(analysis);
        router.push(`/plans/${parentId}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    });
  }

  // --- View 1: upload zone ---
  if (!analysis) {
    return (
      <div className="space-y-4">
        <label
          htmlFor="docx-input"
          className={`flex flex-col items-center justify-center gap-2 py-12 px-6 rounded-[var(--radius-card)] border-2 border-dashed cursor-pointer transition-colors ${
            analyzing
              ? "border-peach/50 bg-peach-soft/30 cursor-wait"
              : "border-ink-faint/40 bg-cream-soft/40 hover:border-peach/50 hover:bg-peach-soft/20"
          }`}
        >
          {analyzing ? (
            <>
              <Loader2 className="h-7 w-7 text-peach-deep animate-spin" strokeWidth={2} />
              <span className="text-base text-ink font-medium">
                Analitzant {fileName ?? "el document"}…
              </span>
              <span className="text-sm text-ink-soft">
                Gemini està llegint i decidint l&apos;estructura. Pot trigar 10-30s en docs llargs.
              </span>
            </>
          ) : (
            <>
              <Upload className="h-8 w-8 text-ink-soft" strokeWidth={2} />
              <span className="text-base text-ink">
                <span className="font-medium text-peach-deep">Clica</span> per
                seleccionar un <code className="font-mono text-sm">.docx</code>
              </span>
              <span className="text-sm text-ink-soft">
                Fins a 10MB · només Word modern (.docx, no .doc)
              </span>
            </>
          )}
          <input
            ref={inputRef}
            id="docx-input"
            type="file"
            accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            onChange={onFileChange}
            disabled={analyzing}
            className="hidden"
          />
        </label>
        {error && (
          <p className="rounded-md border border-peach-deep/40 bg-peach-soft/40 px-4 py-3 text-sm text-ink">
            {error}
          </p>
        )}
      </div>
    );
  }

  // --- View 2: preview de la proposta ---
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-ink-soft">
        <Check className="h-4 w-4 text-sage-deep" strokeWidth={2.5} />
        He llegit <span className="font-medium text-ink">{fileName}</span> i
        aquesta és la proposta:
      </div>

      {/* Pare */}
      <section className="rounded-[var(--radius-card)] border border-peach/40 bg-peach-soft/15 p-5 space-y-3">
        <header className="flex items-start gap-3">
          <span className="grid place-items-center h-10 w-10 rounded-full bg-peach text-white shrink-0">
            <FileText className="h-5 w-5" strokeWidth={2} />
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-xs uppercase tracking-wider text-peach-deep font-medium">
              Pla pare ({analysis.parent.type})
            </p>
            <h2 className="font-serif text-xl font-semibold text-ink leading-tight">
              {analysis.parent.title}
            </h2>
            {analysis.parent.destination && (
              <p className="text-sm text-ink-soft">{analysis.parent.destination}</p>
            )}
          </div>
        </header>
        <p className="text-sm text-ink italic">{analysis.parent.summary}</p>
        <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-ink-soft">
          {(analysis.parent.startDate || analysis.parent.endDate) && (
            <span>
              {analysis.parent.startDate ?? "?"} → {analysis.parent.endDate ?? "?"}
            </span>
          )}
          <span className="flex items-center gap-1">
            <ListTodo className="h-3 w-3" strokeWidth={2} />
            {analysis.parent.checklist.length} items
          </span>
          <span className="flex items-center gap-1">
            <MapPin className="h-3 w-3" strokeWidth={2} />
            {analysis.parent.places.length} llocs
          </span>
          <span>{analysis.parent.body.split("\n").length} línies</span>
        </div>
      </section>

      {/* Fills */}
      {analysis.children.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-sm font-medium text-ink-soft flex items-center gap-2">
            <Layers className="h-4 w-4" strokeWidth={2} />
            {analysis.children.length} sub-plans:
          </h3>
          <ul className="space-y-2">
            {analysis.children.map((c, i) => (
              <li
                key={i}
                className="rounded-md border border-ink-faint/40 bg-cream-soft/60 px-4 py-3"
              >
                <div className="flex items-baseline justify-between gap-3 mb-1">
                  <h4 className="font-serif text-base font-medium text-ink min-w-0 truncate">
                    {c.title}
                  </h4>
                  <span className="text-xs text-ink-soft shrink-0">{c.type}</span>
                </div>
                {c.destination && (
                  <p className="text-xs text-ink-soft">{c.destination}</p>
                )}
                <p className="text-sm text-ink italic line-clamp-2 mt-1">{c.summary}</p>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-soft mt-2">
                  {(c.startDate || c.endDate) && (
                    <span>
                      {c.startDate ?? "?"} → {c.endDate ?? "?"}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <ListTodo className="h-3 w-3" strokeWidth={2} />
                    {c.checklist.length}
                  </span>
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" strokeWidth={2} />
                    {c.places.length}
                  </span>
                  <span>{c.body.split("\n").length} línies</span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {analysis.children.length === 0 && (
        <p className="text-sm text-ink-soft italic">
          (Cap sub-plan: la IA ha decidit que és un pla únic sense divisions.)
        </p>
      )}

      <div className="flex items-center gap-3 pt-4 border-t border-ink-faint/30">
        <Button onClick={create} disabled={creating} variant="primary">
          {creating ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />
              Creant plans i geolocalitzant…
            </>
          ) : (
            <>
              <Check className="h-4 w-4" strokeWidth={2} />
              Crear {1 + analysis.children.length}{" "}
              {analysis.children.length === 0 ? "plan" : "plans"}
            </>
          )}
        </Button>
        <button
          type="button"
          onClick={() => {
            setAnalysis(null);
            setFileName(null);
            setError(null);
          }}
          disabled={creating}
          className="text-sm text-ink-soft hover:text-ink"
        >
          Tornar a començar
        </button>
        {error && <p className="ml-auto text-sm text-peach-deep">{error}</p>}
      </div>

      <p className="text-xs text-ink-soft pt-2 leading-relaxed">
        {(() => {
          const total =
            analysis.parent.places.length +
            analysis.children.reduce((sum, c) => sum + c.places.length, 0);
          const seconds = Math.round(total * 1.2);
          return (
            <>
              Geolocalitzar {total} llocs trigarà uns{" "}
              <strong className="text-ink">~{seconds}s</strong> (Nominatim limita
              a 1 req/s). Si algun lloc no es troba, el plan es crea igualment i
              el pots afegir manualment després.
            </>
          );
        })()}
      </p>
    </div>
  );
}
