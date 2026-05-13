"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Upload } from "lucide-react";
import { getSupabaseBrowser } from "@/lib/supabase-browser";
import { registerPhoto } from "@/lib/photo-actions";

const ACCEPTED_MIMES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "image/avif",
  "image/gif",
]);

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

export function PhotoUploader({ planId }: { planId: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  async function handleFiles(fileList: FileList | File[]) {
    const files = Array.from(fileList).filter((f) => ACCEPTED_MIMES.has(f.type));
    if (files.length === 0) {
      setError("Cap fitxer vàlid (només jpg/png/webp/heic/avif/gif).");
      return;
    }
    setError(null);
    setUploading(true);
    setProgress({ done: 0, total: files.length });

    const supabase = getSupabaseBrowser();
    let done = 0;
    const failures: string[] = [];

    for (const file of files) {
      try {
        const id = crypto.randomUUID();
        const ext = extensionFor(file.type, file.name.split(".").pop() ?? "bin");
        const path = `${planId}/${id}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from("plan-photos")
          .upload(path, file, {
            contentType: file.type,
            upsert: false,
          });
        if (uploadError) throw uploadError;

        await registerPhoto(planId, id, path, file.type);
      } catch (e) {
        failures.push(`${file.name}: ${e instanceof Error ? e.message : String(e)}`);
      } finally {
        done += 1;
        setProgress({ done, total: files.length });
      }
    }

    setUploading(false);
    setProgress(null);
    if (failures.length > 0) {
      setError(failures.join(" · "));
    }
    router.refresh();
  }

  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files);
      e.target.value = "";
    }
  }

  function onDrop(e: React.DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  }

  return (
    <div className="space-y-2">
      <label
        htmlFor="photo-upload"
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={`flex flex-col items-center justify-center gap-2 py-8 px-6 rounded-[var(--radius-card)] border-2 border-dashed cursor-pointer transition-colors ${
          uploading
            ? "border-peach/50 bg-peach-soft/30 cursor-wait"
            : dragOver
              ? "border-peach bg-peach-soft/30"
              : "border-ink-faint/40 bg-cream-soft/40 hover:border-peach/50 hover:bg-peach-soft/20"
        }`}
      >
        {uploading ? (
          <>
            <Loader2 className="h-6 w-6 text-peach-deep animate-spin" strokeWidth={2} />
            <span className="text-sm text-ink">
              Pujant{" "}
              {progress ? `${progress.done}/${progress.total}` : "fotos"}…
            </span>
          </>
        ) : (
          <>
            <Upload className="h-6 w-6 text-ink-soft" strokeWidth={2} />
            <span className="text-sm text-ink">
              <span className="font-medium text-peach-deep">Clica</span> o
              arrossega fotos aquí
            </span>
            <span className="text-xs text-ink-soft">
              jpg, png, webp, heic, avif
            </span>
          </>
        )}
        <input
          ref={inputRef}
          id="photo-upload"
          type="file"
          accept="image/*"
          multiple
          onChange={onChange}
          disabled={uploading}
          className="hidden"
        />
      </label>
      {error && <p className="text-xs text-peach-deep">{error}</p>}
    </div>
  );
}
