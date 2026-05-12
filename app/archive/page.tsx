import { PlanCard } from "@/components/plan-card";
import { EmptyState } from "@/components/empty-state";
import { getArchivedPlans } from "@/lib/plans";

export default async function ArchivePage() {
  const archived = await getArchivedPlans();

  return (
    <div className="mx-auto max-w-6xl px-6 py-12 md:py-16">
      <section className="mb-10 md:mb-14 max-w-3xl">
        <p className="font-hand text-2xl text-ink-soft mb-2 -rotate-1 inline-block">
          el calaix
        </p>
        <h1 className="font-serif text-4xl md:text-5xl font-semibold text-ink leading-[1.05] tracking-tight">
          Arxiu de plans
        </h1>
        <p className="mt-4 text-base md:text-lg text-ink-soft max-w-xl leading-relaxed">
          Plans que hem desat per després. Encara hi són, només descansen.
        </p>
      </section>

      {archived.length === 0 ? (
        <EmptyState
          title="El calaix és buit"
          subtitle="Encara no heu arxivat cap plan. Apareixeran aquí quan en deseu algun."
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {archived.map((p) => (
            <PlanCard key={p.id} plan={p} />
          ))}
        </div>
      )}
    </div>
  );
}
