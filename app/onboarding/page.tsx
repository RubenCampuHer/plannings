import type { Metadata } from "next";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createDemoPlan, skipOnboarding } from "@/lib/onboarding-actions";

export const metadata: Metadata = {
  title: "Benvinguda · Plannings",
};

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const sp = await searchParams;

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-xl">
        <div className="text-center mb-10">
          <span className="grid place-items-center h-14 w-14 mx-auto rounded-full bg-peach text-white shadow-[0_4px_0_0_rgba(226,122,69,0.25)]">
            <Sparkles className="h-6 w-6" strokeWidth={2.25} />
          </span>
          <p className="font-hand text-2xl text-peach-deep mt-5 -rotate-1 inline-block">
            hola, benvingut/da
          </p>
          <h1 className="font-serif text-3xl font-semibold text-ink mt-3">
            Comencem amb plannings
          </h1>
          <p className="text-ink-soft mt-3 text-sm max-w-md mx-auto">
            Un raconet per escriure els teus plans —viatges, caps de setmana, dies
            especials— i tornar-hi quan vulguis. Com vols començar?
          </p>
        </div>

        {sp.error && (
          <div className="rounded-md border border-peach-deep/40 bg-peach-soft/40 px-4 py-3 text-sm text-ink mb-6">
            {sp.error}
          </div>
        )}

        <div className="space-y-4">
          <form action={createDemoPlan}>
            <Button type="submit" variant="primary" className="w-full h-14 text-base">
              Crea un plan de demostració
            </Button>
            <p className="text-xs text-ink-soft text-center mt-2">
              Et farem un plan d'exemple amb les peces principals (text, checklist,
              mapa) perquè el toquis i vegis com funciona.
            </p>
          </form>

          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-ink-faint/40" />
            <span className="text-xs text-ink-soft uppercase tracking-wide">o</span>
            <div className="flex-1 h-px bg-ink-faint/40" />
          </div>

          <form action={skipOnboarding}>
            <Button type="submit" variant="outline" className="w-full h-12">
              Comença buit
            </Button>
            <p className="text-xs text-ink-soft text-center mt-2">
              Ves directament a la pantalla principal i crea el primer plan tu mateix.
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
