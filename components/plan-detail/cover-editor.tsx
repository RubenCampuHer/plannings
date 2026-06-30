"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ImageOff, Loader2, Upload } from "lucide-react";
import { clearCoverImage, setCoverImage } from "@/lib/cover-actions";
import { getSupabaseBrowser } from "@/lib/supabase-browser";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

const ACCEPTED_MIMES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "image/avif",
]);

const ACCEPTED_EXTENSIONS = new Set([
  "jpg",
  "jpeg",
  "png",
  "webp",
  "heic",
  "heif",
  "avif",
]);

// Alguns navegadors (Safari/Android) reporten file.type buit per a HEIC; en
// aquest cas validem per extensió per no rebutjar imatges vàlides del mòbil.
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
    default:
      return fallback;
  }
}

export function CoverEditor({
  planId,
  fallbackGradient,
  initialImageUrl,
  initialImagePath,
}: {
  planId: string;
  fallbackGradient: string;
  initialImageUrl?: string;
  initialImagePath?: string;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [imageUrl, setImageUrl] = useState<string | undefined>(initialImageUrl);
  const [imagePath, setImagePath] = useState<string | undefined>(initialImagePath);
  const [uploading, setUploading] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function uploadFile(file: File) {
    if (!isAcceptedImage(file)) {
      setError("Format no suportat. Usa jpg, png, webp, heic o avif.");
      return;
    }
    setError(null);
    setUploading(true);
    try {
      const supabase = getSupabaseBrowser();
      const ext = extensionFor(file.type, file.name.split(".").pop() ?? "bin");
      const id = crypto.randomUUID();
      const path = `${planId}/cover-${id}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("plan-photos")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (uploadError) throw uploadError;

      await setCoverImage(planId, path);
      // L'objectURL serveix per a una vista immediata abans del refresh (la URL
      // signada vindrà del servidor a la propera càrrega).
      setImageUrl(URL.createObjectURL(file));
      setImagePath(path);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setUploading(false);
    }
  }

  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
    e.target.value = "";
  }

  const [confirmingRemove, setConfirmingRemove] = useState(false);

  function remove() {
    if (!imagePath) return;
    setError(null);
    startTransition(async () => {
      try {
        await clearCoverImage(planId);
        setImageUrl(undefined);
        setImagePath(undefined);
        setConfirmingRemove(false);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    });
  }

  const busy = uploading || pending;
  const hasImage = Boolean(imageUrl);

  return (
    <div className="space-y-3">
      <div
        className="relative h-40 rounded-md border border-ink-faint/40 overflow-hidden"
        style={{
          background: hasImage ? undefined : fallbackGradient,
        }}
      >
        {hasImage && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt="Portada"
            className="absolute inset-0 h-full w-full object-cover"
          />
        )}
        {busy && (
          <div className="absolute inset-0 bg-black/30 grid place-items-center">
            <Loader2 className="h-6 w-6 text-white animate-spin" strokeWidth={2} />
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md border border-ink-faint/50 bg-cream-soft text-sm text-ink hover:border-peach/50 hover:bg-peach-soft/20 disabled:opacity-50 transition-colors"
        >
          <Upload className="h-3.5 w-3.5" strokeWidth={2} />
          {hasImage ? "Canviar imatge" : "Pujar imatge"}
        </button>
        {hasImage && (
          <button
            type="button"
            onClick={() => setConfirmingRemove(true)}
            disabled={busy}
            className="inline-flex items-center gap-1.5 min-h-[44px] sm:min-h-0 sm:h-9 px-3 rounded-md text-sm text-ink-soft hover:text-peach-deep disabled:opacity-50 transition-colors"
          >
            <ImageOff className="h-3.5 w-3.5" strokeWidth={2} />
            Treure imatge
          </button>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          onChange={onChange}
          disabled={busy}
          className="hidden"
        />
      </div>

      <p className="text-xs text-ink-soft leading-relaxed">
        {hasImage
          ? "El degradat de sota servirà si treus la imatge."
          : "Sense imatge, s'utilitza el degradat de sota."}
      </p>

      {error && <p className="text-xs text-peach-deep">{error}</p>}

      <ConfirmDialog
        open={confirmingRemove}
        title="Treure la imatge?"
        description="Es tornarà a mostrar el degradat de sota."
        confirmLabel="Treure"
        destructive
        busy={busy}
        onConfirm={remove}
        onCancel={() => setConfirmingRemove(false)}
      />
    </div>
  );
}
