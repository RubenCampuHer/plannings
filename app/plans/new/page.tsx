import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { PlanForm } from "@/components/plan-detail/plan-form";

export const metadata: Metadata = {
  title: "Nou plan · Plannings",
};

export default function NewPlanPage() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-10 md:py-14">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm text-ink-soft hover:text-ink mb-6"
      >
        <ChevronLeft className="h-4 w-4" strokeWidth={2} />
        Tornar
      </Link>

      <p className="font-hand text-2xl text-peach-deep mb-2 -rotate-1 inline-block">
        què teniu al cap
      </p>
      <h1 className="font-serif text-3xl md:text-4xl font-semibold text-ink mb-2">
        Un plan nou
      </h1>
      <p className="text-ink-soft mb-10">
        Pots deixar-ho a mig — sempre el pots editar després.
      </p>

      <PlanForm />
    </div>
  );
}
