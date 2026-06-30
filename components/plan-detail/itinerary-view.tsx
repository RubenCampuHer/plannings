import { MapPin, ArrowDown } from "lucide-react";
import { formatDate } from "@/lib/format";
import type { Place } from "@/lib/types";

const MONTHS_CA = [
  "gener", "febrer", "març", "abril", "maig", "juny",
  "juliol", "agost", "setembre", "octubre", "novembre", "desembre",
];
const WEEKDAYS_CA = [
  "diumenge", "dilluns", "dimarts", "dimecres", "dijous", "divendres", "dissabte",
];

function dayMonth(iso: string): string {
  const d = new Date(iso + "T00:00:00Z");
  return `${d.getUTCDate()} ${MONTHS_CA[d.getUTCMonth()].slice(0, 3)}`;
}

function weekdayCa(iso: string): string {
  const w = WEEKDAYS_CA[new Date(iso + "T00:00:00Z").getUTCDay()];
  return w.charAt(0).toUpperCase() + w.slice(1);
}

function mapsUrl(p: Place): string {
  return `https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lng}`;
}

/** Un lloc com a "pastilla" que enllaça al Google Maps (coordenades exactes). */
function PlaceChip({ place, muted }: { place: Place; muted?: boolean }) {
  return (
    <a
      href={mapsUrl(place)}
      target="_blank"
      rel="noopener noreferrer"
      title={place.notes ? `${place.notes} · obre al Maps` : "Obre al Google Maps"}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-sm transition-colors hover:border-peach hover:text-peach-deep ${
        muted
          ? "border-ink-faint/40 bg-cream-soft/60 text-ink"
          : "border-ink-faint/40 bg-cream text-ink"
      }`}
    >
      <MapPin className="h-3.5 w-3.5 text-peach-deep shrink-0" strokeWidth={2} />
      {place.name}
    </a>
  );
}

function diffNights(startIso: string, endIso: string): number {
  const a = new Date(startIso + "T00:00:00Z").getTime();
  const b = new Date(endIso + "T00:00:00Z").getTime();
  return Math.max(0, Math.round((b - a) / 86400000));
}

type ZoneGroup = {
  zone: string;
  places: Place[];
  /** Data d'inici (mín. arrival_date dels llocs de la zona), si n'hi ha. */
  start?: string;
};

/**
 * Estança "Itinerari": agrupa els llocs per ZONA/etapa (camp `Place.zone`).
 * Les zones s'ordenen per la seva data d'inici; les nits i el rang es deriven
 * de la data de la zona següent. Perifèric — no toca la prosa del cos.
 */
export function ItineraryView({ places }: { places: Place[] }) {
  const withZone = places.filter((p) => p.zone && p.zone.trim());

  // Fallback: si encara no hi ha cap zona assignada però sí dates, agrupem per
  // dia (comportament previ). Evita regressió abans d'aplicar zones.
  if (withZone.length === 0 && places.some((p) => p.arrivalDate)) {
    return <ByDateView places={places} />;
  }

  const noZone = places
    .filter((p) => !p.zone || !p.zone.trim())
    .sort((a, b) => a.orderIndex - b.orderIndex);

  // Agrupa per zona.
  const byZone = new Map<string, Place[]>();
  for (const p of withZone) {
    const key = p.zone!.trim();
    if (!byZone.has(key)) byZone.set(key, []);
    byZone.get(key)!.push(p);
  }

  const groups: ZoneGroup[] = [...byZone.entries()].map(([zone, ps]) => {
    const dated = ps.filter((p) => p.arrivalDate).map((p) => p.arrivalDate!);
    const start = dated.length ? dated.sort()[0] : undefined;
    return {
      zone,
      start,
      places: ps.sort((a, b) => a.orderIndex - b.orderIndex),
    };
  });

  // Ordena: primer per data d'inici (les sense data, al final per order_index).
  groups.sort((a, b) => {
    if (a.start && b.start) return a.start.localeCompare(b.start);
    if (a.start) return -1;
    if (b.start) return 1;
    return a.places[0].orderIndex - b.places[0].orderIndex;
  });

  if (groups.length === 0 && noZone.length === 0) {
    return (
      <p className="text-sm text-ink-soft">
        Encara no hi ha llocs. Afegeix-ne des de l&apos;editor i assigna&apos;ls una
        zona per organitzar l&apos;itinerari per etapes.
      </p>
    );
  }

  return (
    <div>
      <header className="mb-8">
        <h2 className="font-serif text-2xl font-semibold">L&apos;itinerari</h2>
        <p className="text-sm text-ink-soft mt-1">
          {groups.length > 0
            ? `${groups.length} ${groups.length === 1 ? "zona" : "zones"} en ruta`
            : "Assigna una zona als llocs des de l'editor per veure les etapes."}
        </p>
      </header>

      {groups.length > 0 && (
        <div className="relative pl-8">
          {/* Rail vertical del viatge. */}
          <span
            aria-hidden
            className="absolute left-[10px] top-2 bottom-2 border-l-2 border-dotted border-peach/50"
          />
          {groups.map((g, i) => {
            const next = groups[i + 1];
            // Rang: de la data de la zona fins a la de la següent (− 1 dia).
            let meta: string | null = null;
            if (g.start && next?.start) {
              const nights = diffNights(g.start, next.start);
              meta = `${dayMonth(g.start)}–${dayMonth(next.start)} · ${nights} ${nights === 1 ? "nit" : "nits"}`;
            } else if (g.start) {
              meta = `des del ${dayMonth(g.start)}`;
            }
            return (
              <section key={g.zone} className="relative pb-6 last:pb-0">
                <span className="absolute -left-8 top-1 grid place-items-center h-[22px] w-[22px] rounded-full bg-peach text-white text-[11px] font-bold font-serif border-[3px] border-cream shadow-[0_0_0_1px_var(--color-ink-faint)]">
                  {i + 1}
                </span>
                <div className="rounded-[var(--radius-card)] border border-ink-faint/30 bg-cream-soft/50 px-4 py-3">
                  <div className="flex items-baseline justify-between gap-3 flex-wrap">
                    <h3 className="font-serif text-lg font-semibold text-ink leading-tight">
                      {g.zone}
                    </h3>
                    {meta && (
                      <span className="font-hand text-base text-peach-deep -rotate-1 whitespace-nowrap">
                        {meta}
                      </span>
                    )}
                  </div>
                  <ul className="mt-2 flex flex-wrap gap-1.5">
                    {g.places.map((p) => (
                      <li key={p.id}>
                        <PlaceChip place={p} />
                      </li>
                    ))}
                  </ul>
                </div>
                {next && (
                  <div className="flex items-center gap-1.5 text-xs text-dusty-deep mt-3 pl-0.5">
                    <ArrowDown className="h-3.5 w-3.5" strokeWidth={2} />
                    cap a {next.zone}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}

      {noZone.length > 0 && (
        <section className="mt-8">
          <h3 className="font-serif text-base font-semibold text-ink-soft mb-3">
            Sense zona assignada
          </h3>
          <ul className="flex flex-wrap gap-2">
            {noZone.map((p) => (
              <li key={p.id}>
                <PlaceChip place={p} muted />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

/**
 * Fallback per dia: quan encara no hi ha zones assignades però sí dates.
 * Agrupa els llocs per dia d'arribada.
 */
function ByDateView({ places }: { places: Place[] }) {
  const dated = places.filter((p) => p.arrivalDate);
  const undated = places
    .filter((p) => !p.arrivalDate)
    .sort((a, b) => a.orderIndex - b.orderIndex);

  const byDay = new Map<string, Place[]>();
  for (const p of dated) {
    const key = p.arrivalDate!;
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key)!.push(p);
  }
  const days = [...byDay.entries()]
    .map(([date, ps]) => ({ date, places: ps.sort((a, b) => a.orderIndex - b.orderIndex) }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div className="space-y-8">
      <header>
        <h2 className="font-serif text-2xl font-semibold">L&apos;itinerari</h2>
        <p className="text-sm text-ink-soft mt-1">
          {days.length} {days.length === 1 ? "dia" : "dies"} amb llocs · assigna
          zones des de l&apos;editor per agrupar-los per etapes
        </p>
      </header>
      {days.map((day, di) => (
        <section key={day.date} className="relative">
          <div className="flex items-baseline gap-3 mb-3">
            <span className="grid place-items-center h-9 w-9 shrink-0 rounded-full bg-peach text-white text-sm font-semibold font-serif shadow-[0_2px_0_0_rgba(226,122,69,0.3)]">
              {di + 1}
            </span>
            <div>
              <h3 className="font-serif text-lg font-semibold text-ink leading-tight">
                {weekdayCa(day.date)}
              </h3>
              <p className="font-hand text-base text-peach-deep -rotate-1">
                {formatDate(day.date)}
              </p>
            </div>
          </div>
          <ul className="flex flex-wrap gap-1.5 pl-12">
            {day.places.map((p) => (
              <li key={p.id}>
                <PlaceChip place={p} />
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
              <li key={p.id}>
                <PlaceChip place={p} muted />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
