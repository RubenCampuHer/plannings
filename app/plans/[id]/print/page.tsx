import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AutoPrint, PrintButton } from "@/components/plan-detail/auto-print";
import {
  PlanCoverPage,
  PlanContent,
  getPlanSections,
} from "@/components/plan-detail/print-plan-content";
import { getChildPlans, getPlanById } from "@/lib/plans";
import { extractH2Headings } from "@/lib/toc";

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

  const children = await getChildPlans(plan.id);
  const autoFire = sp.auto !== "0";

  const mainAnchor = `plan-${plan.id}`;
  const mainSections = getPlanSections(plan);
  const mainHeadings = mainSections.hasBody
    ? extractH2Headings(plan.body)
    : [];

  return (
    <>
      {/* Estils només per a aquesta ruta — amaguen el header/footer del root
          layout i ajusten les pàgines A4. Les <style> tags s'hoisten a <head>
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
          .print-page-break-before { break-before: page; page-break-before: always; }
          .print-cover { break-after: page; page-break-after: always; }
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

        {/* 1. PORTADA */}
        <PlanCoverPage plan={plan} anchorId={mainAnchor} isMain />

        {/* 2. ÍNDEX */}
        <section
          id="index"
          className="print-page-break-before print-avoid-break mb-12"
        >
          <h2 className="font-serif text-3xl font-semibold mb-6">Índex</h2>
          <ol className="space-y-4 text-sm leading-relaxed">
            <TocPlanEntry
              anchor={mainAnchor}
              title={plan.title}
              sections={mainSections}
              h2s={mainHeadings.map((h) => h.text)}
              label="Pla principal"
            />
            {children.map((child) => {
              const sections = getPlanSections(child);
              const h2s = sections.hasBody
                ? extractH2Headings(child.body).map((h) => h.text)
                : [];
              return (
                <TocPlanEntry
                  key={child.id}
                  anchor={`plan-${child.id}`}
                  title={child.title}
                  sections={sections}
                  h2s={h2s}
                  label="Sub-plan"
                />
              );
            })}
          </ol>
        </section>

        {/* 3. CONTINGUT DEL PLAN PRINCIPAL */}
        <div className="print-page-break-before">
          <h2 className="font-serif text-3xl font-semibold mb-8">
            {plan.title}
          </h2>
          <PlanContent plan={plan} />
        </div>

        {/* 4. SUB-PLANS, cadascun en una nova pàgina amb portada pròpia */}
        {children.map((child) => (
          <div key={child.id} className="print-page-break-before">
            <PlanCoverPage
              plan={child}
              anchorId={`plan-${child.id}`}
              isMain={false}
            />
            <div className="print-page-break-before">
              <PlanContent plan={child} />
            </div>
          </div>
        ))}

        {/* Peu personal */}
        <footer className="mt-16 pt-6 border-t border-ink-faint/40 text-center font-hand text-base text-ink-soft -rotate-[0.5deg]">
          plannings · els nostres plans
        </footer>
      </article>
    </>
  );
}

function TocPlanEntry({
  anchor,
  title,
  sections,
  h2s,
  label,
}: {
  anchor: string;
  title: string;
  sections: ReturnType<typeof getPlanSections>;
  h2s: string[];
  label: string;
}) {
  return (
    <li>
      <a
        href={`#${anchor}`}
        className="font-serif text-lg font-semibold text-ink hover:text-peach-deep"
      >
        <span className="font-hand text-sm text-peach-deep mr-2">{label}</span>
        {title}
      </a>
      {(h2s.length > 0 ||
        sections.hasPlaces ||
        sections.hasChecklist ||
        sections.hasExpenses) && (
        <ul className="mt-1.5 ml-6 space-y-1 text-ink-soft">
          {h2s.map((text, i) => (
            <li key={`h2-${i}`} className="before:content-['·_'] before:text-peach">
              {text}
            </li>
          ))}
          {sections.hasPlaces && (
            <li className="before:content-['·_'] before:text-peach">Ruta</li>
          )}
          {sections.hasChecklist && (
            <li className="before:content-['·_'] before:text-peach">
              Checklist
            </li>
          )}
          {sections.hasExpenses && (
            <li className="before:content-['·_'] before:text-peach">
              Pressupost
            </li>
          )}
        </ul>
      )}
    </li>
  );
}
