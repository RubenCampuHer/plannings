import Link from "next/link";
import { MapPin, Plus } from "lucide-react";
import type { PlanStatus, PlanType } from "@/lib/types";

export type SubPlanRef = {
  id: string;
  title: string;
  type: PlanType;
  status: PlanStatus;
  destination?: string;
};

export function SubPlansCard({
  parentId,
  subPlans,
}: {
  parentId: string;
  subPlans: SubPlanRef[];
}) {
  return (
    <section aria-label="Sub-plans" className="px-1">
      <header className="flex items-baseline justify-between mb-2">
        <h2 className="font-hand text-xl text-peach-deep -rotate-1 inline-block">
          sub-plans
        </h2>
        {subPlans.length > 0 && (
          <span className="text-xs text-ink-soft tabular-nums">
            {subPlans.length}
          </span>
        )}
      </header>

      {subPlans.length > 0 ? (
        <ul className="space-y-0.5 text-sm mb-2">
          {subPlans.map((c) => (
            <li key={c.id}>
              <Link
                href={`/plans/${c.id}`}
                className="group block py-1 pl-3 -ml-px border-l-2 border-ink-faint/25 hover:border-peach/60 transition-colors"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-ink group-hover:text-peach-deep min-w-0 truncate">
                    {c.title}
                  </span>
                  {c.status === "archived" && (
                    <span className="text-[10px] uppercase tracking-wider text-ink-soft/60 shrink-0">
                      arxivat
                    </span>
                  )}
                </div>
                {c.destination && (
                  <div className="flex items-center gap-1 text-xs text-ink-soft truncate">
                    <MapPin className="h-3 w-3 shrink-0" strokeWidth={2} />
                    <span className="truncate">{c.destination}</span>
                  </div>
                )}
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-ink-soft mb-2 leading-relaxed pl-3">
          Útil per a viatges amb varies regions.
        </p>
      )}

      <Link
        href={`/plans/new?parent=${encodeURIComponent(parentId)}`}
        className="inline-flex items-center gap-1 pl-3 -ml-px text-sm text-peach-deep hover:text-ink transition-colors"
      >
        <Plus className="h-3.5 w-3.5" strokeWidth={2.25} />
        Afegir sub-plan
      </Link>
    </section>
  );
}
