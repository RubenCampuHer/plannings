import Link from "next/link";
import { Check, ChevronRight, Circle } from "lucide-react";

export type SubChecklistGroup = {
  planId: string;
  title: string;
  items: Array<{ id: string; text: string; done: boolean }>;
};

/**
 * Vista agregada (només lectura) de les "coses per fer" específiques de cada
 * sub-plà, perquè al pla pare es vegin totes en un sol lloc. L'edició es fa al
 * sub-plà (enllaç a la capçalera de cada grup). Els genèrics viuen a la
 * checklist pròpia del pla; aquí només hi ha els específics de cada país.
 */
export function SubChecklists({ groups }: { groups: SubChecklistGroup[] }) {
  const withItems = groups.filter((g) => g.items.length > 0);
  if (withItems.length === 0) return null;

  return (
    <section aria-label="Per fer a cada país" className="px-1">
      <h2 className="font-hand text-xl text-peach-deep -rotate-1 inline-block mb-2">
        per fer a cada país
      </h2>
      <div className="space-y-4">
        {withItems.map((g) => {
          const done = g.items.filter((i) => i.done).length;
          return (
            <div key={g.planId}>
              <Link
                href={`/plans/${g.planId}`}
                className="group flex items-baseline justify-between gap-2 mb-1"
              >
                <span className="text-sm font-medium text-ink group-hover:text-peach-deep inline-flex items-center gap-0.5 min-w-0">
                  <span className="truncate">{g.title}</span>
                  <ChevronRight
                    className="h-3.5 w-3.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                    strokeWidth={2}
                  />
                </span>
                <span className="text-xs text-ink-soft tabular-nums shrink-0">
                  {done}/{g.items.length}
                </span>
              </Link>
              <ul className="space-y-1 pl-0.5">
                {g.items.map((i) => (
                  <li key={i.id} className="flex items-start gap-2 text-sm">
                    {i.done ? (
                      <Check className="h-3.5 w-3.5 mt-0.5 shrink-0 text-sage-deep" strokeWidth={2.5} />
                    ) : (
                      <Circle className="h-3.5 w-3.5 mt-0.5 shrink-0 text-ink-faint" strokeWidth={2} />
                    )}
                    <span className={i.done ? "text-ink-soft line-through" : "text-ink-soft"}>
                      {i.text}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </section>
  );
}
