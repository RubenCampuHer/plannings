import Link from "next/link";
import { formatShortDate } from "@/lib/format";

export type TimelineChild = {
  id: string;
  title: string;
  startDate?: string;
  endDate?: string;
};

/**
 * Mini-Gantt horitzontal: una barra per cada sub-plan amb data,
 * eix temporal continu, indicador vertical "avui" si cau dins el rang.
 *
 * Server component pur (sense `use client`): càlculs determinístics
 * a render time. Si l'usuari obre el detall un altre dia, el "avui"
 * es recalcula sol.
 */
export function SubPlansTimeline({
  parentStart,
  parentEnd,
  items,
}: {
  parentStart?: string;
  parentEnd?: string;
  items: TimelineChild[];
}) {
  // Només fills amb dates completes; els que no en tenen no es poden situar.
  const dated = items
    .filter((c): c is Required<Pick<TimelineChild, "startDate" | "endDate">> & TimelineChild =>
      Boolean(c.startDate && c.endDate),
    )
    .sort((a, b) => a.startDate.localeCompare(b.startDate));

  if (dated.length < 1) return null;

  // Rang del timeline: mín i màx entre fills i (opcionalment) el pare.
  const allStarts = dated.map((c) => c.startDate);
  const allEnds = dated.map((c) => c.endDate);
  if (parentStart) allStarts.push(parentStart);
  if (parentEnd) allEnds.push(parentEnd);
  const rangeStart = allStarts.sort()[0];
  const rangeEnd = allEnds.sort().at(-1)!;

  const startMs = new Date(rangeStart).getTime();
  const endMs = new Date(rangeEnd).getTime();
  const spanMs = endMs - startMs || 1;
  // Server component: Date.now() s'avalua un cop per request. Lint el marca com
  // impur perquè genera-lment una crida així en un client component re-renderitzaria
  // inestablement, però aquí ens va bé: cada càrrega = "avui" actualitzat.
  // eslint-disable-next-line react-hooks/purity
  const todayMs = Date.now();
  const todayPct = ((todayMs - startMs) / spanMs) * 100;
  const todayInRange = todayPct >= 0 && todayPct <= 100;
  // Data d'avui en ISO (YYYY-MM-DD) per marcar quina peça és "ara" a la vista mòbil.
  const todayISO = new Date(todayMs).toISOString().slice(0, 10);

  function pctFor(date: string): number {
    return ((new Date(date).getTime() - startMs) / spanMs) * 100;
  }

  return (
    <section
      aria-label="Quan toca cada sub-plan"
      className="rounded-[var(--radius-card)] bg-cream-soft/70 border border-ink-faint/30 p-5"
    >
      <header className="flex items-baseline justify-between mb-4">
        <h2 className="font-serif text-lg font-semibold flex items-center gap-2">
          Quan toca cada peça
        </h2>
        <span className="font-hand text-base text-ink-soft -rotate-1">
          {formatShortDate(rangeStart)} → {formatShortDate(rangeEnd)}
        </span>
      </header>

      {/* Gantt horitzontal: només sm+ (al mòbil les barres curtes queden
          il·legibles). Al mòbil fem servir l'agenda vertical de sota. */}
      <div className="hidden sm:block relative space-y-2.5">
        {/* Línia vertical "avui" si cau al rang. */}
        {todayInRange && (
          <div
            className="absolute top-0 bottom-0 w-px bg-peach z-10 pointer-events-none"
            style={{ left: `${Math.min(98, Math.max(2, todayPct))}%` }}
            aria-hidden
          >
            <div className="absolute -top-1 -left-1 h-2 w-2 rounded-full bg-peach" />
            <div className="absolute -top-6 -translate-x-1/2 font-hand text-xs text-peach-deep whitespace-nowrap -rotate-1">
              avui
            </div>
          </div>
        )}

        {dated.map((c) => {
          const left = Math.max(0, pctFor(c.startDate));
          const right = Math.min(100, pctFor(c.endDate));
          const width = Math.max(2, right - left); // mínim 2% perquè es vegi una barra curta (1 dia)
          return (
            <Link
              key={c.id}
              href={`/plans/${c.id}`}
              className="group block relative h-10 rounded-md bg-cream/40 hover:bg-cream transition-colors border border-ink-faint/20"
            >
              <div
                className="absolute top-1 bottom-1 rounded-[5px] bg-peach/60 group-hover:bg-peach transition-colors flex items-center px-2 min-w-0 overflow-hidden"
                style={{ left: `${left}%`, width: `${width}%` }}
              >
                <span className="text-xs font-medium text-white truncate drop-shadow-[0_1px_1px_rgba(0,0,0,0.3)]">
                  {c.title}
                </span>
              </div>
              {/* A mòbil amaguem el rang de dates: amb barres amples xocava amb
                  el títol. A sm+ hi torna a haver espai. */}
              <span className="hidden sm:block absolute right-2 top-1/2 -translate-y-1/2 text-[11px] text-ink-soft tabular-nums whitespace-nowrap">
                {formatShortDate(c.startDate)} → {formatShortDate(c.endDate)}
              </span>
            </Link>
          );
        })}
      </div>

      {/* Agenda vertical: vista mòbil, llegible a pantalla estreta. Cada peça a
          amplada completa, en ordre cronològic, amb el seu rang de dates. */}
      <ul className="sm:hidden space-y-2">
        {dated.map((c) => {
          const isNow = todayISO >= c.startDate && todayISO <= c.endDate;
          return (
            <li key={c.id}>
              <Link
                href={`/plans/${c.id}`}
                className={`flex items-center gap-3 rounded-md border px-3 py-2.5 transition-colors ${
                  isNow
                    ? "border-peach/50 bg-peach/10"
                    : "border-ink-faint/20 bg-cream/40 hover:bg-cream"
                }`}
              >
                <span
                  className={`h-2 w-2 shrink-0 rounded-full ${
                    isNow ? "bg-peach" : "bg-peach/60"
                  }`}
                  aria-hidden
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-ink truncate">
                    {c.title}
                  </span>
                  <span className="block text-xs text-ink-soft tabular-nums">
                    {formatShortDate(c.startDate)} → {formatShortDate(c.endDate)}
                  </span>
                </span>
                {isNow && (
                  <span className="shrink-0 font-hand text-xs text-peach-deep -rotate-1">
                    avui
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
