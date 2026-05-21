import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Calendar, MapPin } from "lucide-react";
import { HomeCalendar } from "@/components/home-calendar";
import { PlanFilters } from "@/components/plan-filters";
import { countActivePlans, getPlans, getPlansHappeningNow } from "@/lib/plans";
import { formatDateRange } from "@/lib/format";
import type { Plan, PlanStatus, PlanType } from "@/lib/types";

function asType(v?: string | string[]): PlanType | "all" {
  const s = Array.isArray(v) ? v[0] : v;
  if (s === "deep" || s === "weekend" || s === "day") return s;
  return "all";
}
function asStatus(v?: string | string[]): PlanStatus | "all" {
  const s = Array.isArray(v) ? v[0] : v;
  if (s === "planning" || s === "active" || s === "completed") return s;
  return "all";
}
function asQ(v?: string | string[]): string {
  return (Array.isArray(v) ? v[0] : v) ?? "";
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; status?: string; q?: string }>;
}) {
  const sp = await searchParams;
  const query = {
    type: asType(sp.type),
    status: asStatus(sp.status),
    q: asQ(sp.q),
  };

  const hasFilter =
    query.type !== "all" || query.status !== "all" || query.q !== "";

  const [plans, activeCount, nowPlans, allPlans] = await Promise.all([
    getPlans(query),
    countActivePlans(),
    // Featured peek: agafa plans que "passen ara mateix" — `status='active'`
    // explícit O avui dins de [start_date, end_date]. Només surt al hero si
    // la llista té exactament 1 (si n'hi ha 0 o 2+, no destaquem res).
    getPlansHappeningNow(),
    // Calendari: tots els plans top-level no arxivats, sense filtre. Si no hi
    // ha filtre actiu, reusem el `plans` per estalviar un roundtrip.
    hasFilter ? getPlans({}) : Promise.resolve(null),
  ]);

  const calendarPlans = allPlans ?? plans;
  const featured = nowPlans.length === 1 ? nowPlans[0] : null;

  // Onboarding: si l'usuari no té cap pla i encara no ha passat per /onboarding,
  // l'enviem allà. La cookie es marca quan acaba l'onboarding. Només dispara
  // sense filtres actius i quan tot el calendari està buit (= cap pla visible).
  if (!hasFilter && calendarPlans.length === 0) {
    const cookieStore = await cookies();
    if (!cookieStore.get("plannings_onboarded")) {
      redirect("/onboarding");
    }
  }
  // El featured també apareix al grid (no es filtra): així un usuari que fa scroll
  // continua veient tots els plans, i el featured és només un realç visual a dalt.

  return (
    <div className="mx-auto max-w-6xl px-6 py-12 md:py-16">
      <section className="mb-10 md:mb-12 max-w-3xl">
        <p className="font-hand text-2xl text-peach-deep mb-2 -rotate-1 inline-block">
          hola, vosaltres dos
        </p>
        <h1 className="font-serif text-4xl md:text-5xl font-semibold text-ink leading-[1.05] tracking-tight">
          Els plans que teniu
          <br />
          <span className="italic text-ink-soft font-normal">en marxa</span>
        </h1>
        <p className="mt-5 text-base md:text-lg text-ink-soft max-w-xl leading-relaxed">
          Un lloc per recordar els somnis grans, les escapades petites
          i tot el que voleu fer junts.{" "}
          {activeCount === 0 ? (
            "Encara no n'hi ha cap d'obert."
          ) : activeCount === 1 ? (
            <>
              Ara mateix teniu{" "}
              <strong className="text-ink font-semibold">1 plan</strong> obert.
            </>
          ) : (
            <>
              Ara mateix teniu{" "}
              <strong className="text-ink font-semibold">{activeCount} plans</strong>{" "}
              oberts.
            </>
          )}
        </p>
      </section>

      {featured && <ActiveFeature plan={featured} />}

      <HomeCalendar plans={calendarPlans} />

      <PlanFilters plans={plans} currentQuery={query} />
    </div>
  );
}

function ActiveFeature({ plan }: { plan: Plan }) {
  const dateRange = formatDateRange(plan.startDate, plan.endDate);
  return (
    <section className="mb-12 md:mb-14">
      <p className="font-hand text-xl text-peach-deep -rotate-1 inline-block mb-2 ml-1">
        ara mateix
      </p>
      <Link
        href={`/plans/${plan.id}`}
        className="group flex gap-0 rounded-[var(--radius-card)] bg-cream-soft border border-ink-faint/30 hover:border-peach/50 transition-all duration-300 overflow-hidden hover:shadow-[0_12px_24px_-12px_rgba(58,46,42,0.18)] hover:-translate-y-0.5"
      >
        <div
          className="relative w-32 sm:w-40 md:w-48 shrink-0 bg-cover bg-center"
          style={{
            background: plan.coverImageUrl
              ? `url("${plan.coverImageUrl}") center / cover no-repeat`
              : plan.cover,
          }}
          aria-hidden
        >
          <div className="absolute inset-0 bg-gradient-to-tr from-black/10 to-transparent" />
        </div>
        <div className="flex-1 min-w-0 py-5 px-5 md:py-6 md:px-7 flex flex-col gap-2">
          <h2 className="font-serif text-2xl md:text-[1.7rem] font-semibold text-ink group-hover:text-peach-deep transition-colors leading-tight">
            {plan.title}
          </h2>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-ink-soft">
            {plan.destination && (
              <span className="flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5" strokeWidth={2} />
                <span className="truncate">{plan.destination}</span>
              </span>
            )}
            {dateRange && (
              <span className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" strokeWidth={2} />
                {dateRange}
              </span>
            )}
          </div>
          <p className="text-sm md:text-base text-ink-soft leading-relaxed line-clamp-2">
            {plan.summary}
          </p>
        </div>
      </Link>
    </section>
  );
}
