import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { PlanForm } from "@/components/plan-detail/plan-form";
import { PlacesEditor } from "@/components/plan-detail/places-editor";
import { PolishWithAi } from "@/components/plan-detail/polish-with-ai";
import { getPlanById } from "@/lib/plans";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const plan = await getPlanById(id);
  return {
    title: plan ? `Editant ${plan.title} · Plannings` : "Plan no trobat · Plannings",
  };
}

export default async function EditPlanPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const plan = await getPlanById(id);
  if (!plan) notFound();

  return (
    <div className="mx-auto max-w-4xl px-6 py-10 md:py-14">
      <Link
        href={`/plans/${plan.id}`}
        className="inline-flex items-center gap-1.5 text-sm text-ink-soft hover:text-ink mb-6"
      >
        <ChevronLeft className="h-4 w-4" strokeWidth={2} />
        Tornar al plan
      </Link>

      <h1 className="font-serif text-3xl md:text-4xl font-semibold text-ink mb-2">
        Editant <span className="italic text-ink-soft font-normal">{plan.title}</span>
      </h1>
      <p className="text-ink-soft mb-10">
        Canvia el que vulguis. Els llocs es desen al moment; la resta amb "Desar canvis".
      </p>

      <PlanForm plan={plan} />

      <div className="mt-16">
        <PolishWithAi planId={plan.id} />
      </div>

      <div className="mt-12 pt-10 border-t border-ink-faint/30">
        <PlacesEditor planId={plan.id} initialPlaces={plan.places} />
      </div>
    </div>
  );
}
