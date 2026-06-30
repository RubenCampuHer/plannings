"use client";

import { useRef, useState } from "react";
import { ImagePlus, Loader2 } from "lucide-react";
import { getSupabaseBrowser } from "@/lib/supabase-browser";

const ACCEPTED_MIMES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "image/avif",
  "image/gif",
]);

const ACCEPTED_EXTENSIONS = new Set([
  "jpg",
  "jpeg",
  "png",
  "webp",
  "heic",
  "heif",
  "avif",
  "gif",
]);

// Safari/Android poden reportar file.type buit per a HEIC; validem per extensió.
function isAcceptedImage(file: File): boolean {
  if (ACCEPTED_MIMES.has(file.type)) return true;
  if (file.type === "" || file.type === "application/octet-stream") {
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    return ACCEPTED_EXTENSIONS.has(ext);
  }
  return false;
}

function extensionFor(mime: string, fallback: string): string {
  switch (mime) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "image/heic":
      return "heic";
    case "image/heif":
      return "heif";
    case "image/avif":
      return "avif";
    case "image/gif":
      return "gif";
    default:
      return fallback;
  }
}

/**
 * Botó que puja una imatge al bucket `plan-photos` i insereix la referència
 * Markdown corresponent al cursor del textarea identificat per `textareaId`.
 * La sintaxi `pp:planId/inline-uuid.ext` es resol a render time a MarkdownBody.
 */
export function InlineImageInserter({
  planId,
  textareaId = "body",
}: {
  planId: string;
  textareaId?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    if (!isAcceptedImage(file)) {
      setError("Format no suportat.");
      return;
    }
    setError(null);
    setUploading(true);
    try {
      const supabase = getSupabaseBrowser();
      const id = crypto.randomUUID();
      const ext = extensionFor(file.type, file.name.split(".").pop() ?? "bin");
      const path = `${planId}/inline-${id}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("plan-photos")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (uploadError) throw uploadError;

      const markdown = `\n\n![](pp:${path})\n\n`;
      const textarea = document.getElementById(textareaId) as
        | HTMLTextAreaElement
        | null;
      if (textarea) {
        const start = textarea.selectionStart ?? textarea.value.length;
        const end = textarea.selectionEnd ?? textarea.value.length;
        const value = textarea.value;
        textarea.value = value.slice(0, start) + markdown + value.slice(end);
        const newPos = start + markdown.length;
        textarea.selectionStart = textarea.selectionEnd = newPos;
        textarea.focus();
        // Notifica el form perquè formData ho reculli al submit.
        textarea.dispatchEvent(new Event("input", { bubbles: true }));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setUploading(false);
    }
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="inline-flex items-center gap-1.5 text-xs text-peach-deep hover:text-ink disabled:opacity-50 transition-colors"
      >
        {uploading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2} />
        ) : (
          <ImagePlus className="h-3.5 w-3.5" strokeWidth={2} />
        )}
        {uploading ? "Pujant…" : "Inserir imatge"}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = "";
        }}
        className="hidden"
      />
      {error && <span className="text-xs text-peach-deep">{error}</span>}
    </span>
  );
}
