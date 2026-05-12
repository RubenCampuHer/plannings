import { PlanFilters } from "@/components/plan-filters";
import { countActivePlans, getPlans } from "@/lib/plans";
import type { PlanStatus, PlanType } from "@/lib/types";

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

  const [plans, activeCount] = await Promise.all([
    getPlans(query),
    countActivePlans(),
  ]);

  return (
    <div className="mx-auto max-w-6xl px-6 py-12 md:py-16">
      <section className="mb-12 md:mb-16 max-w-3xl">
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

      <PlanFilters plans={plans} currentQuery={query} />
    </div>
  );
}
