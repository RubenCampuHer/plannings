import Link from "next/link";
import { formatDateRange, TYPE_LABELS_CA } from "@/lib/format";
import type { Plan } from "@/lib/types";

const MONTHS_CA = [
  "gener",
  "febrer",
  "març",
  "abril",
  "maig",
  "juny",
  "juliol",
  "agost",
  "setembre",
  "octubre",
  "novembre",
  "desembre",
];

function monthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return `${MONTHS_CA[m - 1]} ${y}`;
}

/**
 * Vista temporal del home: tots els plans amb data, agrupats per mes d'inici,
 * en ordre cronològic. Plans sense data no apareixen aquí (es veuen al grid).
 *
 * Server component: el "today" es recalcula a cada render request, sense
 * necessitat d'hidratar al client.
 */
export function HomeCalendar({ plans }: { plans: Plan[] }) {
  const dated = plans
    .filter((p): p is Plan & { startDate: string } => Boolean(p.startDate))
    .sort((a, b) => a.startDate.localeCompare(b.startDate));

  if (dated.length === 0) return null;

  const grouped = new Map<string, typeof dated>();
  for (const p of dated) {
    const key = p.startDate.slice(0, 7); // "YYYY-MM"
    const arr = grouped.get(key) ?? [];
    arr.push(p);
    grouped.set(key, arr);
  }

  const todayKey = new Date().toISOString().slice(0, 7);

  return (
    <section className="mb-12 md:mb-14">
      <p className="font-hand text-xl text-peach-deep -rotate-1 inline-block mb-3 ml-1">
        calendari
      </p>
      <div className="rounded-[var(--radius-card)] border border-ink-faint/30 bg-cream-soft/50 p-5 md:p-6">
        <div className="space-y-7">
          {Array.from(grouped.entries()).map(([key, monthPlans]) => {
            const isCurrentMonth = key === todayKey;
            return (
              <div key={key}>
                <div className="flex items-baseline gap-3 mb-3">
                  <h3
                    className={`font-serif text-lg ${
                      isCurrentMonth
                        ? "text-peach-deep font-semibold"
                        : "text-ink"
                    }`}
                  >
                    {monthLabel(key)}
                  </h3>
                  {isCurrentMonth && (
                    <span className="font-hand text-base text-peach-deep -rotate-1">
                      som aquí
                    </span>
                  )}
                  <div className="flex-1 border-b border-ink-faint/30 mb-1" />
                </div>
                <ul className="space-y-0.5">
                  {monthPlans.map((p) => (
                    <li key={p.id}>
                      <Link
                        href={`/plans/${p.id}`}
                        className="group block py-1.5 pl-3 -ml-px border-l-2 border-ink-faint/25 hover:border-peach/60 transition-colors"
                      >
                        <div className="flex items-baseline gap-x-3 gap-y-0.5 flex-wrap">
                          <span className="font-medium text-ink group-hover:text-peach-deep transition-colors">
                            {p.title}
                          </span>
                          <span className="text-xs text-ink-soft tabular-nums">
                            {formatDateRange(p.startDate, p.endDate)}
                          </span>
                          {p.destination && (
                            <span className="text-xs text-ink-soft truncate">
                              · {p.destination}
                            </span>
                          )}
                          <span className="text-[10px] uppercase tracking-wider text-ink-soft/70 ml-auto">
                            {TYPE_LABELS_CA[p.type]}
                          </span>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
