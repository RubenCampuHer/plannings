import { formatShortDate } from "@/lib/format";
import type { Place } from "@/lib/types";

export function PlaceList({ places }: { places: Place[] }) {
  if (places.length === 0) return null;
  const ordered = [...places].sort((a, b) => a.orderIndex - b.orderIndex);

  return (
    <section>
      <h2 className="font-serif text-xl font-semibold mb-4">Ruta</h2>
      <ol className="relative space-y-0">
        {ordered.map((place, i) => (
          <li key={place.id} className="relative pl-10 pb-6 last:pb-0">
            {/* Dotted connector */}
            {i < ordered.length - 1 && (
              <span
                aria-hidden
                className="absolute left-[14px] top-7 bottom-0 border-l-2 border-dotted border-peach/50"
              />
            )}
            <span className="absolute left-0 top-0 grid place-items-center h-7 w-7 rounded-full bg-peach text-white text-xs font-semibold font-serif shadow-[0_2px_0_0_rgba(226,122,69,0.3)]">
              {i + 1}
            </span>
            <div className="flex flex-wrap items-baseline gap-x-2">
              <span className="font-serif text-base font-semibold text-ink">
                {place.name}
              </span>
              {place.country && (
                <span className="text-xs text-ink-soft">· {place.country}</span>
              )}
              {place.arrivalDate && (
                <span className="font-hand text-base text-peach-deep ml-auto">
                  {formatShortDate(place.arrivalDate)}
                </span>
              )}
            </div>
            {place.notes && (
              <p className="mt-1 text-sm text-ink-soft leading-relaxed">{place.notes}</p>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
