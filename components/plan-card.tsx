import Link from "next/link";
import { MapPin, Coins } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  formatDateRange,
  formatMoney,
  STATUS_LABELS_CA,
  TYPE_LABELS_CA,
} from "@/lib/format";
import type { Plan } from "@/lib/types";

// Tots els badges sobre covers (imatge o gradient) van amb `glass`: els tonals
// es fonien amb gradients del mateix color (un chip sage sobre un gradient
// peach→sage no es veia). Glass dóna contrast garantit sobre qualsevol fons.

export function PlanCard({ plan }: { plan: Plan }) {
  const dateRange = formatDateRange(plan.startDate, plan.endDate);
  const budget = formatMoney(plan.budgetTotal, plan.budgetCurrency);

  return (
    <Link
      href={`/plans/${plan.id}`}
      className="group relative flex flex-col overflow-hidden rounded-[var(--radius-card)] bg-cream-soft border border-ink-faint/30 hover:border-peach/50 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_12px_24px_-12px_rgba(58,46,42,0.18)]"
    >
      {/* Cover */}
      <div
        className="relative h-44 overflow-hidden bg-cover bg-center"
        style={{
          background: plan.coverImageUrl
            ? `url("${plan.coverImageUrl}") center / cover no-repeat`
            : plan.cover,
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-black/10 to-transparent" />
        <div className="absolute top-3 left-3 flex gap-1.5">
          <Badge variant="glass">{TYPE_LABELS_CA[plan.type]}</Badge>
          {plan.status !== "planning" && (
            <Badge variant="glass">{STATUS_LABELS_CA[plan.status]}</Badge>
          )}
        </div>
        {dateRange && (
          <div className="absolute bottom-3 right-3 font-hand text-xl text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.55)] -rotate-2">
            {dateRange}
          </div>
        )}
      </div>

      {/* Body */}
      <div className="flex flex-col gap-2.5 p-5 flex-1">
        <h3 className="font-serif text-[1.35rem] leading-tight font-semibold text-ink group-hover:text-peach-deep transition-colors">
          {plan.title}
        </h3>
        <p className="text-sm text-ink-soft leading-relaxed line-clamp-2 flex-1">
          {plan.summary}
        </p>
        <div className="flex items-center gap-4 mt-1 pt-3 border-t border-ink-faint/40 text-xs text-ink-soft">
          {plan.destination && (
            <span className="flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5" strokeWidth={2} />
              <span className="truncate max-w-[180px]">{plan.destination}</span>
            </span>
          )}
          {budget && (
            <span className="flex items-center gap-1.5 ml-auto">
              <Coins className="h-3.5 w-3.5" strokeWidth={2} />
              {budget}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
