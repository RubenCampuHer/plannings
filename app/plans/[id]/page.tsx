import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MapPin, Calendar, Coins } from "lucide-react";
import { PlanActionsBar } from "@/components/plan-detail/plan-actions-bar";
import { CoverHero } from "@/components/plan-detail/cover-hero";
import { MapSection } from "@/components/plan-detail/map-section";
import { MarkdownBody } from "@/components/plan-detail/markdown-body";
import { Checklist } from "@/components/plan-detail/checklist";
import { ExpenseTable } from "@/components/plan-detail/expense-table";
import { PhotoGallery } from "@/components/plan-detail/photo-gallery";
import { DocumentList } from "@/components/plan-detail/document-list";
import { PlaceList } from "@/components/plan-detail/place-list";
import { formatDateRange, formatMoney } from "@/lib/format";
import { getPlanById } from "@/lib/plans";
import type { Plan } from "@/lib/types";

// Sense generateStaticParams: amb auth la pàgina és per-request,
// pre-generar al build no aporta i a més no hi ha cookies disponibles llavors.
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const plan = await getPlanById(id);
  if (!plan) return { title: "Plan no trobat · Plannings" };
  const suffix = plan.destination ? ` · ${plan.destination}` : "";
  return {
    title: `${plan.title}${suffix} · Plannings`,
    description: plan.summary,
  };
}

export default async function PlanDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const plan = await getPlanById(id);
  if (!plan) notFound();

  const dateRange = formatDateRange(plan.startDate, plan.endDate);
  const budget = formatMoney(plan.budgetTotal, plan.budgetCurrency);
  const hasSidebar =
    plan.checklist.length > 0 ||
    plan.expenses.length > 0 ||
    plan.documents.length > 0;

  return (
    <article>
      <CoverHero plan={plan} dateRange={dateRange} />

      {/* Quick info strip */}
      <section className="border-b border-ink-faint/40 bg-cream-soft/70 backdrop-blur-sm">
        <div className="mx-auto max-w-6xl px-6 py-4 flex flex-wrap items-center gap-x-8 gap-y-2 text-sm">
          {plan.destination && (
            <span className="flex items-center gap-2 text-ink-soft">
              <MapPin className="h-4 w-4" strokeWidth={1.75} />
              <span className="text-ink">{plan.destination}</span>
            </span>
          )}
          {dateRange && (
            <span className="flex items-center gap-2 text-ink-soft">
              <Calendar className="h-4 w-4" strokeWidth={1.75} />
              <span className="text-ink">{dateRange}</span>
            </span>
          )}
          {budget && (
            <span className="flex items-center gap-2 text-ink-soft">
              <Coins className="h-4 w-4" strokeWidth={1.75} />
              <span className="text-ink">{budget}</span>
            </span>
          )}
          {/* Amagats a mòbil per espai; el CRUD complet arribarà amb M3. */}
          <PlanActionsBar
            planId={plan.id}
            planTitle={plan.title}
            isArchived={plan.status === "archived"}
          />
        </div>
      </section>

      {/* Body */}
      <div className="mx-auto max-w-6xl px-6 py-12">
        {hasSidebar ? (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-12 items-start">
            <div className="space-y-12 min-w-0">
              <PlanMain plan={plan} />
            </div>
            <aside className="space-y-5 lg:sticky lg:top-24">
              <Checklist items={plan.checklist} />
              <ExpenseTable
                expenses={plan.expenses}
                budgetTotal={plan.budgetTotal}
                currency={plan.budgetCurrency}
              />
              <DocumentList documents={plan.documents} />
            </aside>
          </div>
        ) : (
          // Wishlist o plans encara sense logística: tot al main per no deixar columna fantasma.
          <div className="max-w-3xl space-y-12">
            <PlanMain plan={plan} />
          </div>
        )}
      </div>
    </article>
  );
}

function PlanMain({ plan }: { plan: Plan }) {
  return (
    <>
      <section>
        <p className="font-serif text-xl italic text-ink-soft leading-relaxed mb-8">
          {plan.summary}
        </p>
        <MarkdownBody>{plan.body}</MarkdownBody>
      </section>

      {plan.places.length > 0 && (
        <section className="space-y-6">
          <h2 className="font-serif text-2xl font-semibold">El mapa</h2>
          <MapSection places={plan.places} />
        </section>
      )}

      {plan.places.length > 0 && <PlaceList places={plan.places} />}

      <PhotoGallery photos={plan.photos} />
    </>
  );
}
