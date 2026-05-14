"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles } from "lucide-react";
import { polishImagesWithAi } from "@/lib/ai-actions";

/**
 * Botó inline (estil similar a InlineImageInserter) que llegeix el contingut
 * actual del textarea, demana a la IA + Pexels les imatges, les puja al bucket
 * i les insereix al body. Després actualitza el textarea perquè l'usuari pugui
 * revisar abans de "Desar canvis". Les files de `plan_photos` (per a l'Àlbum)
 * sí que es desen al moment a la BBDD.
 */
export function PolishImagesButton({
  planId,
  textareaId = "body",
}: {
  planId: string;
  textareaId?: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function run() {
    setError(null);
    setSuccess(null);
    const textarea = document.getElementById(textareaId) as
      | HTMLTextAreaElement
      | null;
    if (!textarea) {
      setError("No s'ha trobat l'editor del body.");
      return;
    }
    const currentBody = textarea.value;
    if (!currentBody.trim()) {
      setError("Escriu una mica abans (la IA necessita context).");
      return;
    }

    setPending(true);
    try {
      const result = await polishImagesWithAi(planId, currentBody);

      // Injecta el nou body al textarea i avisa el form.
      textarea.value = result.newBody;
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
      textarea.scrollIntoView({ behavior: "smooth", block: "start" });

      // Refresca per actualitzar l'Àlbum (plan_photos ja desat).
      router.refresh();

      const parts: string[] = [];
      parts.push(
        result.added === 1
          ? "1 imatge inserida"
          : `${result.added} imatges inserides`,
      );
      if (result.failed.length > 0) parts.push(`${result.failed.length} sense match`);
      setSuccess(parts.join(" · ") + " — recorda desar");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setPending(false);
    }
  }

  return (
    <span className="inline-flex items-center gap-2 flex-wrap">
      <button
        type="button"
        onClick={run}
        disabled={pending}
        title="Genera imatges amb IA + Pexels i les insereix al body i a l'Àlbum"
        className="inline-flex items-center gap-1.5 text-xs text-peach-deep hover:text-ink disabled:opacity-50 transition-colors"
      >
        {pending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2} />
        ) : (
          <Sparkles className="h-3.5 w-3.5" strokeWidth={2} />
        )}
        {pending ? "Generant imatges… (~20s)" : "Polish imatges amb IA"}
      </button>
      {success && (
        <span className="text-xs text-sage-deep">✓ {success}</span>
      )}
      {error && <span className="text-xs text-peach-deep">{error}</span>}
    </span>
  );
}
