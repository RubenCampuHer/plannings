import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MapPin, Calendar, Coins, ArrowLeft } from "lucide-react";
import { MarkdownBody } from "@/components/plan-detail/markdown-body";
import { AutoPrint, PrintButton } from "@/components/plan-detail/auto-print";
import { formatDateRange, formatMoney, formatShortDate } from "@/lib/format";
import { getChildPlanRefs, getPlanById } from "@/lib/plans";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const plan = await getPlanById(id);
  if (!plan) return { title: "Plan no trobat · Plannings" };
  return { title: `${plan.title} · Per imprimir` };
}

export default async function PlanPrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ auto?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const plan = await getPlanById(id);
  if (!plan) notFound();

  const dateRange = formatDateRange(plan.startDate, plan.endDate);
  const budget = formatMoney(plan.budgetTotal, plan.budgetCurrency);
  const children = await getChildPlanRefs(plan.id);
  const orderedPlaces = [...plan.places].sort(
    (a, b) => a.orderIndex - b.orderIndex,
  );
  const autoFire = sp.auto !== "0";

  return (
    <>
      {/* Amaga header/footer del root layout només en aquesta ruta + ajusta
          marges a A4 en mode impressió. Les <style> tags s'hoisten a <head>
          automàticament en React 19. */}
      <style>{`
        body > div > header { display: none !important; }
        body > div > footer { display: none !important; }
        body::before { display: none !important; }
        @page { size: A4; margin: 18mm 16mm; }
        @media print {
          .print-hide { display: none !important; }
          .print-page { padding: 0 !important; }
          .print-avoid-break { break-inside: avoid; page-break-inside: avoid; }
          .print-page-break { break-before: page; page-break-before: always; }
          html, body { background: white !important; }
        }
      `}</style>

      {autoFire && <AutoPrint />}

      <article className="print-page mx-auto max-w-3xl px-6 py-10 text-ink">
        {/* Barra de controls — només pantalla */}
        <div className="print-hide mb-8 flex items-center justify-between gap-4 text-sm">
          <Link
            href={`/plans/${plan.id}`}
            className="inline-flex items-center gap-1.5 text-ink-soft hover:text-ink"
          >
            <ArrowLeft className="h-4 w-4" strokeWidth={2} />
            Tornar al plan
          </Link>
          <PrintButton />
        </div>

        {/* Portada */}
        <header className="print-avoid-break mb-10 border-b border-ink-faint/50 pb-8">
          {plan.coverImageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={plan.coverImageUrl}
              alt=""
              className="mb-6 w-full h-56 object-cover rounded-[var(--radius-card)]"
            />
          )}
          <h1 className="font-serif text-4xl font-semibold leading-tight">
            {plan.title}
          </h1>
          {plan.summary && (
            <p className="mt-4 text-lg text-ink-soft italic leading-relaxed">
              {plan.summary}
            </p>
          )}
          <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-ink-soft">
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
        </header>

        {/* Cos del plan */}
        {plan.body.trim() && (
          <section className="mb-10">
            <MarkdownBody>{plan.body}</MarkdownBody>
          </section>
        )}

        {/* Ruta / Llocs */}
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

        {/* Checklist */}
        {plan.checklist.length > 0 && (
          <section className="print-avoid-break mb-10">
            <h2 className="font-serif text-2xl font-semibold mb-5">Checklist</h2>
            <ul className="space-y-1.5 text-sm">
              {plan.checklist.map((item) => (
                <li key={item.id} className="flex items-start gap-2.5">
                  <span
                    aria-hidden
                    className="mt-[3px] inline-block h-3.5 w-3.5 border border-ink rounded-sm flex-shrink-0 leading-none text-center"
                    style={{
                      fontSize: "10px",
                      lineHeight: "12px",
                    }}
                  >
                    {item.done ? "✓" : ""}
                  </span>
                  <span
                    className={
                      item.done
                        ? "text-ink-soft line-through"
                        : "text-ink"
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

        {/* Despeses */}
        {plan.expenses.length > 0 && (
          <section className="print-avoid-break mb-10">
            <h2 className="font-serif text-2xl font-semibold mb-5">
              {plan.expenses.some((e) => e.isEstimated)
                ? "Pressupost"
                : "Despeses"}
            </h2>
            <table className="w-full text-sm">
              <tbody className="divide-y divide-ink-faint/50">
                {plan.expenses.map((e) => (
                  <tr key={e.id}>
                    <td className="py-2 pr-3">
                      <span className="font-medium">{e.category}</span>
                      {e.description && (
                        <span className="text-ink-soft">
                          {" "}
                          · {e.description}
                        </span>
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

        {/* Sub-plans (només titulars amb dates) */}
        {children.length > 0 && (
          <section className="print-avoid-break mb-10">
            <h2 className="font-serif text-2xl font-semibold mb-5">
              Sub-plans
            </h2>
            <ul className="space-y-2 text-sm">
              {children.map((c) => {
                const range = formatDateRange(c.startDate, c.endDate);
                return (
                  <li key={c.id} className="flex flex-wrap gap-x-3 gap-y-0.5">
                    <span className="font-semibold">{c.title}</span>
                    {c.destination && (
                      <span className="text-ink-soft">· {c.destination}</span>
                    )}
                    {range && (
                      <span className="text-ink-soft">· {range}</span>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {/* Peu personal */}
        <footer className="mt-12 pt-6 border-t border-ink-faint/40 text-center font-hand text-base text-ink-soft -rotate-[0.5deg]">
          plannings · els nostres plans
        </footer>
      </article>
    </>
  );
}
