"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { deletePhoto } from "@/lib/photo-actions";
import type { PlanPhoto } from "@/lib/types";
import { PhotoUploader } from "./photo-uploader";

export function PhotoGallery({
  planId,
  photos,
}: {
  planId: string;
  photos: PlanPhoto[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleDelete(photoId: string) {
    if (!confirm("Esborrar aquesta foto?")) return;
    startTransition(async () => {
      try {
        await deletePhoto(planId, photoId);
        router.refresh();
      } catch (e) {
        alert(e instanceof Error ? e.message : String(e));
      }
    });
  }

  return (
    <section className="space-y-5">
      <header className="flex items-baseline justify-between">
        <h2 className="font-serif text-xl font-semibold">Fotos i moodboard</h2>
        {photos.length > 0 && (
          <span className="font-hand text-base text-ink-soft -rotate-1">
            {photos.length}{" "}
            {photos.length === 1 ? "imatge" : "imatges"}
          </span>
        )}
      </header>

      <PhotoUploader planId={planId} />

      {photos.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {photos.map((p, i) => {
            const hasImage = Boolean(p.imageUrl);
            return (
              <figure
                key={p.id}
                className="group relative aspect-[4/5] rounded-2xl overflow-hidden border border-ink-faint/30"
                style={{
                  background: hasImage
                    ? undefined
                    : p.gradient ?? "linear-gradient(135deg, #F8C8A0, #A8C4A2)",
                  transform: `rotate(${i % 2 === 0 ? "-0.5" : "0.5"}deg)`,
                }}
              >
                {hasImage && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.imageUrl}
                    alt={p.caption ?? ""}
                    loading="lazy"
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />
                {p.caption && (
                  <figcaption className="absolute bottom-2 left-3 right-3 font-hand text-white text-lg drop-shadow-[0_1px_2px_rgba(0,0,0,0.4)]">
                    {p.caption}
                  </figcaption>
                )}
                <button
                  type="button"
                  onClick={() => handleDelete(p.id)}
                  disabled={pending}
                  aria-label="Esborrar foto"
                  className="absolute top-2 right-2 opacity-80 sm:opacity-0 sm:group-hover:opacity-100 focus-visible:opacity-100 disabled:opacity-50 transition-opacity grid place-items-center h-8 w-8 rounded-full bg-black/40 hover:bg-peach-deep text-white backdrop-blur-sm"
                >
                  <Trash2 className="h-4 w-4" strokeWidth={2} />
                </button>
              </figure>
            );
          })}
        </div>
      )}
    </section>
  );
}
