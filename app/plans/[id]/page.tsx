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
import { PlanBreadcrumb } from "@/components/plan-detail/plan-breadcrumb";
import { FloatingChat } from "@/components/plan-detail/floating-chat";
import { EditableBody } from "@/components/plan-detail/editable-body";
import { EditableSummary } from "@/components/plan-detail/editable-summary";
import { PlanRooms, type Room } from "@/components/plan-detail/plan-rooms";
import { PlanToc } from "@/components/plan-detail/plan-toc";
import { SubPlansCard } from "@/components/plan-detail/sub-plans-card";
import { SubPlansTimeline } from "@/components/plan-detail/sub-plans-timeline";
import { formatDateRange, formatMoney } from "@/lib/format";
import { getChildPlanRefs, getPlanById } from "@/lib/plans";
import { extractH2Headings } from "@/lib/toc";

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

function parseRoom(v: string | string[] | undefined): Room {
  const value = Array.isArray(v) ? v[0] : v;
  if (value === "mapa" || value === "album") return value;
  return "resum";
}

export default async function PlanDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ v?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const plan = await getPlanById(id);
  if (!plan) notFound();

  const dateRange = formatDateRange(plan.startDate, plan.endDate);
  const budget = formatMoney(plan.budgetTotal, plan.budgetCurrency);
  const tocHeadings = extractH2Headings(plan.body);
  const showToc = tocHeadings.length >= 3;
  const children = await getChildPlanRefs(plan.id);
  // Card de sub-plans visible si ja en té, o si és un viatge llarg (deep) on
  // sol tenir sentit afegir-ne.
  const showSubPlans = children.length > 0 || plan.type === "deep";

  // Estances disponibles:
  // - Resum sempre (la pestanya principal amb cos + sidebar).
  // - Mapa només si hi ha llocs (l'editor de llocs viu a /edit, no es pot afegir des d'aquí).
  // - Àlbum: per a viatges/escapades sempre (perquè es pot pujar des d'aquí encara que estigui buit);
  //   per a plans `day` només quan ja hi ha fotos.
  const hasMapa = plan.places.length > 0;
  const hasAlbum = plan.photos.length > 0 || plan.type !== "day";
  const available: Room[] = [
    "resum",
    ...(hasMapa ? (["mapa"] as const) : []),
    ...(hasAlbum ? (["album"] as const) : []),
  ];
  const requested = parseRoom(sp.v);
  const room: Room = available.includes(requested) ? requested : "resum";
  const showRooms = available.length > 1;

  return (
    <article>
      {plan.parent && <PlanBreadcrumb parent={plan.parent} />}
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
          <PlanActionsBar
            planId={plan.id}
            planTitle={plan.title}
            isArchived={plan.status === "archived"}
          />
        </div>
      </section>

      {/* Estances (només si hi ha més d'una) */}
      {showRooms && (
        <section className="border-b border-ink-faint/40 bg-cream-soft/40">
          <div className="mx-auto max-w-6xl px-6">
            <PlanRooms
              active={room}
              available={available}
              placeCount={plan.places.length}
              photoCount={plan.photos.length}
            />
          </div>
        </section>
      )}

      <div className="mx-auto max-w-6xl px-6 py-12">
        {room === "resum" && (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-12 items-start">
            <div className="space-y-12 min-w-0">
              {/* Timeline només si hi ha sub-plans amb dates; ajuda a veure
                  d'un cop d'ull "quan toca cada peça" en viatges llargs. */}
              {children.some((c) => c.startDate && c.endDate) && (
                <SubPlansTimeline
                  parentStart={plan.startDate}
                  parentEnd={plan.endDate}
                  items={children}
                />
              )}
              <section>
                <EditableSummary planId={plan.id} value={plan.summary} />
                <EditableBody planId={plan.id} source={plan.body}>
                  <MarkdownBody>{plan.body}</MarkdownBody>
                </EditableBody>
              </section>
            </div>
            <aside className="space-y-5 lg:sticky lg:top-24">
              {showToc && <PlanToc headings={tocHeadings} />}
              {showSubPlans && (
                <SubPlansCard parentId={plan.id} subPlans={children} />
              )}
              <Checklist planId={plan.id} items={plan.checklist} />
              <ExpenseTable
                expenses={plan.expenses}
                budgetTotal={plan.budgetTotal}
                currency={plan.budgetCurrency}
              />
              <DocumentList documents={plan.documents} />
            </aside>
          </div>
        )}

        {room === "mapa" && (
          <div className="space-y-8 max-w-5xl mx-auto">
            <header>
              <h2 className="font-serif text-2xl font-semibold">El mapa</h2>
              <p className="text-sm text-ink-soft mt-1">
                {plan.places.length}{" "}
                {plan.places.length === 1 ? "lloc al recorregut" : "llocs al recorregut"}
              </p>
            </header>
            <MapSection places={plan.places} />
            <PlaceList places={plan.places} />
          </div>
        )}

        {room === "album" && (
          <div className="max-w-5xl mx-auto">
            <PhotoGallery planId={plan.id} photos={plan.photos} />
          </div>
        )}
      </div>

      {/* Copilot flotant: FAB sempre visible al detall del plan, panell
          arrossegable al desktop / bottom sheet al mòbil. */}
      <FloatingChat planId={plan.id} planTitle={plan.title} />
    </article>
  );
}
