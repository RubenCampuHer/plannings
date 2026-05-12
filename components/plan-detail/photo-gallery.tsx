import type { PlanPhoto } from "@/lib/types";

export function PhotoGallery({ photos }: { photos: PlanPhoto[] }) {
  if (photos.length === 0) return null;

  return (
    <section>
      <h2 className="font-serif text-xl font-semibold mb-4">Fotos i moodboard</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {photos.map((p, i) => (
          <figure
            key={p.id}
            className="group relative aspect-[4/5] rounded-2xl overflow-hidden border border-ink-faint/30"
            style={{
              background: p.gradient ?? "linear-gradient(135deg, #F8C8A0, #A8C4A2)",
              transform: `rotate(${i % 2 === 0 ? "-0.5" : "0.5"}deg)`,
            }}
          >
            <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />
            {p.caption && (
              <figcaption className="absolute bottom-2 left-3 right-3 font-hand text-white text-lg drop-shadow-[0_1px_2px_rgba(0,0,0,0.4)]">
                {p.caption}
              </figcaption>
            )}
          </figure>
        ))}
      </div>
    </section>
  );
}
