import { MapPin, Calendar, Coins } from "lucide-react";
import { MarkdownBody } from "@/components/plan-detail/markdown-body";
import { formatDateRange, formatMoney, formatShortDate } from "@/lib/format";
import type { Plan } from "@/lib/types";

// Pàgina de portada A4: ocupa tota una pàgina i força un page-break després
// si el chrome respecta `break-after: page`. Si no, el contingut següent surt
// just a sota.
export function PlanCoverPage({
  plan,
  anchorId,
  isMain,
}: {
  plan: Plan;
  anchorId: string;
  isMain: boolean;
}) {
  const dateRange = formatDateRange(plan.startDate, plan.endDate);
  const budget = formatMoney(plan.budgetTotal, plan.budgetCurrency);

  return (
    <section
      id={anchorId}
      className="print-cover print-avoid-break min-h-[260mm] flex flex-col"
    >
      {plan.coverImageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={plan.coverImageUrl}
          alt=""
          className="w-full h-[140mm] object-cover rounded-[var(--radius-card)] mb-10"
        />
      )}
      <div className="flex-1 flex flex-col justify-center">
        {!isMain && (
          <p className="font-hand text-2xl text-peach-deep mb-3 -rotate-[0.6deg]">
            Sub-plan
          </p>
        )}
        <h1
          className={
            isMain
              ? "font-serif font-semibold leading-[1.05] text-5xl"
              : "font-serif font-semibold leading-[1.1] text-4xl"
          }
        >
          {plan.title}
        </h1>
        {plan.summary && (
          <p className="mt-5 text-lg text-ink-soft italic leading-relaxed max-w-[80%]">
            {plan.summary}
          </p>
        )}
        <div className="mt-8 flex flex-wrap items-center gap-x-7 gap-y-2 text-base text-ink-soft">
          {plan.destination && (
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="h-4 w-4" strokeWidth={1.75} />
              {plan.destination}
            </span>
          )}
          {dateRange && (
            <span className="inline-flex items-center gap-1.5">
              <Calendar className="h-4 w-4" strokeWidth={1.75} />
              {dateRange}
            </span>
          )}
          {budget && (
            <span className="inline-flex items-center gap-1.5">
              <Coins className="h-4 w-4" strokeWidth={1.75} />
              {budget}
            </span>
          )}
        </div>
      </div>
    </section>
  );
}

// Contingut llistable de seccions d'un plan (body + ruta + checklist + despeses).
// Reutilitzat per al plan principal i per a cada sub-plan.
export function PlanContent({ plan }: { plan: Plan }) {
  const orderedPlaces = [...plan.places].sort(
    (a, b) => a.orderIndex - b.orderIndex,
  );

  return (
    <>
      {plan.body.trim() && (
        <section className="mb-10">
          <MarkdownBody>{plan.body}</MarkdownBody>
        </section>
      )}

      {orderedPlaces.length > 0 && (
        <section className="print-avoid-break mb-10">
          <h2 className="font-serif text-2xl font-semibold mb-5">
            Ruta · {orderedPlaces.length}{" "}
            {orderedPlaces.length === 1 ? "lloc" : "llocs"}
          </h2>
          <ol className="space-y-3">
            {orderedPlaces.map((p, i) => (
              <li
                key={p.id}
                className="print-avoid-break flex gap-3 text-sm leading-relaxed"
              >
                <span className="font-serif font-semibold text-peach-deep min-w-[1.5rem]">
                  {i + 1}.
                </span>
                <span className="flex-1">
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lng}`}
                    target="_blank"
                    rel="noopener"
                    className="font-semibold text-ink underline decoration-peach decoration-2 underline-offset-[3px] hover:decoration-peach-deep"
                  >
                    {p.name}
                  </a>
                  {p.country && (
                    <span className="text-ink-soft"> · {p.country}</span>
                  )}
                  {p.arrivalDate && (
                    <span className="ml-2 text-ink-soft">
                      ({formatShortDate(p.arrivalDate)})
                    </span>
                  )}
                  {p.notes && (
                    <span className="block text-ink-soft mt-0.5">
                      {p.notes}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {plan.checklist.length > 0 && (
        <section className="print-avoid-break mb-10">
          <h2 className="font-serif text-2xl font-semibold mb-5">Checklist</h2>
          <ul className="space-y-1.5 text-sm">
            {plan.checklist.map((item) => (
              <li key={item.id} className="flex items-start gap-2.5">
                <span
                  aria-hidden
                  className="mt-[3px] inline-block h-3.5 w-3.5 border border-ink rounded-sm flex-shrink-0 leading-none text-center"
                  style={{ fontSize: "10px", lineHeight: "12px" }}
                >
                  {item.done ? "✓" : ""}
                </span>
                <span
                  className={
                    item.done ? "text-ink-soft line-through" : "text-ink"
                  }
                >
                  {item.text}
                  {item.dueDate && (
                    <span className="text-ink-soft ml-2">
                      ({formatShortDate(item.dueDate)})
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {plan.expenses.length > 0 && (
        <section className="print-avoid-break mb-10">
          <h2 className="font-serif text-2xl font-semibold mb-5">
            {plan.expenses.some((e) => e.isEstimated) ? "Pressupost" : "Despeses"}
          </h2>
          <table className="w-full text-sm">
            <tbody className="divide-y divide-ink-faint/50">
              {plan.expenses.map((e) => (
                <tr key={e.id}>
                  <td className="py-2 pr-3">
                    <span className="font-medium">{e.category}</span>
                    {e.description && (
                      <span className="text-ink-soft"> · {e.description}</span>
                    )}
                  </td>
                  <td className="py-2 text-right whitespace-nowrap">
                    {e.isEstimated && (
                      <span className="text-ink-soft text-xs">~ </span>
                    )}
                    {formatMoney(e.amount, e.currency)}
                  </td>
                </tr>
              ))}
              <tr className="font-serif font-semibold">
                <td className="pt-3">Total</td>
                <td className="pt-3 text-right">
                  {formatMoney(
                    plan.expenses.reduce((a, e) => a + e.amount, 0),
                    plan.budgetCurrency ?? "EUR",
                  )}
                </td>
              </tr>
            </tbody>
          </table>
        </section>
      )}
    </>
  );
}

// Resum de seccions disponibles per a un plan (per a l'índex).
export type PlanSections = {
  hasBody: boolean;
  hasPlaces: boolean;
  hasChecklist: boolean;
  hasExpenses: boolean;
};

export function getPlanSections(plan: Plan): PlanSections {
  return {
    hasBody: plan.body.trim().length > 0,
    hasPlaces: plan.places.length > 0,
    hasChecklist: plan.checklist.length > 0,
    hasExpenses: plan.expenses.length > 0,
  };
}
