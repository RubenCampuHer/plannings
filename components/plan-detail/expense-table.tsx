import { formatMoney } from "@/lib/format";
import type { Expense } from "@/lib/types";

export function ExpenseTable({
  expenses,
  budgetTotal,
  currency = "EUR",
}: {
  expenses: Expense[];
  budgetTotal?: number;
  currency?: string;
}) {
  if (expenses.length === 0) return null;

  const total = expenses.reduce((acc, e) => acc + e.amount, 0);
  const anyEstimated = expenses.some((e) => e.isEstimated);

  return (
    <section className="rounded-[var(--radius-card)] bg-cream-soft/70 border border-ink-faint/30 p-6">
      <header className="flex items-baseline justify-between mb-4">
        <h2 className="font-serif text-lg font-semibold">
          {anyEstimated ? "Pressupost" : "Despeses"}
        </h2>
        {budgetTotal && (
          <span className="font-hand text-lg text-peach-deep -rotate-1">
            {formatMoney(budgetTotal, currency)}
          </span>
        )}
      </header>
      <ul className="divide-y divide-ink-faint/30">
        {expenses.map((e) => (
          <li key={e.id} className="flex items-baseline justify-between py-2.5 text-sm">
            <span className="flex-1">
              <span className="text-ink">{e.category}</span>
              {e.description && (
                <span className="text-ink-soft text-xs ml-2">{e.description}</span>
              )}
            </span>
            <span className="text-ink-soft tabular-nums">
              {e.isEstimated && <span className="text-xs mr-1">~</span>}
              {formatMoney(e.amount, e.currency)}
            </span>
          </li>
        ))}
      </ul>
      <div className="flex items-baseline justify-between pt-3 mt-3 border-t border-ink/15">
        <span className="text-sm font-medium">Total</span>
        <span className="font-serif font-semibold tabular-nums">
          {formatMoney(total, currency)}
        </span>
      </div>
    </section>
  );
}
