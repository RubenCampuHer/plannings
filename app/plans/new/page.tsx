import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { PlanForm } from "@/components/plan-detail/plan-form";
import { getPlanById } from "@/lib/plans";

export const metadata: Metadata = {
  title: "Nou plan · Plannings",
};

export const dynamic = "force-dynamic";

export default async function NewPlanPage({
  searchParams,
}: {
  searchParams: Promise<{ parent?: string }>;
}) {
  const { parent: parentId } = await searchParams;
  // Si ve un ?parent= vàlid, carreguem el seu títol per al hint i el hidden input.
  const parent = parentId ? await getPlanById(parentId) : undefined;
  const parentRef = parent ? { id: parent.id, title: parent.title } : undefined;
  // Si l'usuari ha clicat "Afegir sub-plan" tornem al pare; si no, al home.
  const backHref = parentRef ? `/plans/${parentRef.id}` : "/";
  const backLabel = parentRef ? `Tornar a ${parentRef.title}` : "Tornar";

  return (
    <div className="mx-auto max-w-4xl px-6 py-10 md:py-14">
      <Link
        href={backHref}
        className="inline-flex items-center gap-1.5 text-sm text-ink-soft hover:text-ink mb-6"
      >
        <ChevronLeft className="h-4 w-4" strokeWidth={2} />
        {backLabel}
      </Link>

      <p className="font-hand text-2xl text-peach-deep mb-2 -rotate-1 inline-block">
        {parentRef ? "una peça més del viatge" : "què teniu al cap"}
      </p>
      <h1 className="font-serif text-3xl md:text-4xl font-semibold text-ink mb-2">
        {parentRef ? "Un sub-plan nou" : "Un plan nou"}
      </h1>
      <p className="text-ink-soft mb-4">
        Pots deixar-ho a mig — sempre el pots editar després.
      </p>
      {!parentRef && (
        <p className="text-sm text-ink-soft mb-10">
          O importa&apos;l des d&apos;un document:{" "}
          <Link
            href="/plans/import"
            className="text-peach-deep hover:text-ink underline underline-offset-2"
          >
            Importar des de Word
          </Link>
        </p>
      )}

      <PlanForm parent={parentRef} />
    </div>
  );
}
