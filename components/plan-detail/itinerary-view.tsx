import { MapPin } from "lucide-react";
import { formatDate } from "@/lib/format";
import type { Place } from "@/lib/types";

const WEEKDAYS_CA = [
  "diumenge",
  "dilluns",
  "dimarts",
  "dimecres",
  "dijous",
  "divendres",
  "dissabte",
];

function weekdayCa(iso: string): string {
  const w = WEEKDAYS_CA[new Date(iso).getDay()];
  return w.charAt(0).toUpperCase() + w.slice(1);
}

type Day = { date: string; places: Place[] };

/**
 * Estança "Itinerari": agrupa els llocs del pla per dia d'arribada (la data viu
 * a `Place.arrivalDate`). Perifèric — NO toca la prosa del cos. Server component
 * pur: l'ordenació és determinista a render time.
 */
export function ItineraryView({ places }: { places: Place[] }) {
  const dated = places.filter((p) => p.arrivalDate);
  const undated = places
    .filter((p) => !p.arrivalDate)
    .sort((a, b) => a.orderIndex - b.orderIndex);

  // Agrupa per dia i ordena els dies cronològicament; dins del dia, per ordre de ruta.
  const byDay = new Map<string, Place[]>();
  for (const p of dated) {
    const key = p.arrivalDate!;
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key)!.push(p);
  }
  const days: Day[] = [...byDay.entries()]
    .map(([date, ps]) => ({
      date,
      places: ps.sort((a, b) => a.orderIndex - b.orderIndex),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  if (days.length === 0 && undated.length === 0) {
    return (
      <p className="text-sm text-ink-soft">
        Encara no hi ha llocs. Afegeix-ne des de l&apos;editor i assigna&apos;ls una
        data per veure l&apos;itinerari per dies.
      </p>
    );
  }

  return (
    <div className="space-y-10">
      <header>
        <h2 className="font-serif text-2xl font-semibold">L&apos;itinerari</h2>
        <p className="text-sm text-ink-soft mt-1">
          {days.length > 0
            ? `${days.length} ${days.length === 1 ? "dia" : "dies"} amb llocs assignats`
            : "Assigna dates als llocs des de l'editor per ordenar-los per dies."}
        </p>
      </header>

      {days.map((day, di) => (
        <section key={day.date} className="relative">
          <div className="flex items-baseline gap-3 mb-4">
            <span className="grid place-items-center h-9 w-9 shrink-0 rounded-full bg-peach text-white text-sm font-semibold font-serif shadow-[0_2px_0_0_rgba(226,122,69,0.3)]">
              {di + 1}
            </span>
            <div className="min-w-0">
              <h3 className="font-serif text-lg font-semibold text-ink leading-tight">
                {weekdayCa(day.date)}
              </h3>
              <p className="font-hand text-base text-peach-deep -rotate-1">
                {formatDate(day.date)}
              </p>
            </div>
          </div>

          <ul className="space-y-2 pl-12">
            {day.places.map((p) => (
              <li
                key={p.id}
                className="rounded-[var(--radius-card)] border border-ink-faint/30 bg-cream-soft/50 px-4 py-3"
              >
                <div className="flex items-baseline gap-2 flex-wrap">
                  <MapPin
                    className="h-4 w-4 text-peach-deep shrink-0 self-center"
                    strokeWidth={2}
                  />
                  <span className="font-serif font-semibold text-ink">
                    {p.name}
                  </span>
                  {p.country && (
                    <span className="text-xs text-ink-soft">· {p.country}</span>
                  )}
                </div>
                {p.notes && (
                  <p className="text-sm text-ink-soft leading-relaxed mt-1 pl-6">
                    {p.notes}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}

      {undated.length > 0 && (
        <section>
          <h3 className="font-serif text-base font-semibold text-ink-soft mb-3">
            Sense data assignada
          </h3>
          <ul className="flex flex-wrap gap-2">
            {undated.map((p) => (
              <li
                key={p.id}
                className="inline-flex items-center gap-1.5 rounded-full border border-ink-faint/40 bg-cream-soft/60 px-3 py-1.5 text-sm text-ink"
              >
                <MapPin className="h-3.5 w-3.5 text-ink-soft" strokeWidth={2} />
                {p.name}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
