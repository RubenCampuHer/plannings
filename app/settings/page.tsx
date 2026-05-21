import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { User, Crown, Users } from "lucide-react";
import { createSupabaseServer } from "@/lib/supabase-server";
import { DeleteAccountButton } from "@/components/settings/delete-account-button";
import { LeavePlanButton } from "@/components/settings/leave-plan-button";

export const metadata: Metadata = {
  title: "Configuració · Plannings",
};

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/settings");

  // Plans on soc owner.
  const { data: ownedPlans } = await supabase
    .from("plans")
    .select("id, title")
    .eq("owner_id", user.id)
    .order("updated_at", { ascending: false });

  // Plans on soc membre però no owner.
  const { data: memberRows } = await supabase
    .from("plan_members")
    .select("plan_id, plans!inner(id, title, owner_id)")
    .eq("user_id", user.id);

  type MemberRow = { plan_id: string; plans: { id: string; title: string; owner_id: string } };
  const guestPlans =
    ((memberRows as MemberRow[] | null) ?? []).filter(
      (r) => r.plans.owner_id !== user.id,
    ).map((r) => r.plans);

  const provider = user.app_metadata?.provider ?? "email";

  return (
    <div className="mx-auto max-w-3xl px-6 py-12 md:py-16 space-y-10">
      <header>
        <h1 className="font-serif text-3xl font-semibold text-ink">
          Configuració
        </h1>
        <p className="text-ink-soft mt-2 text-sm">
          El teu compte i els teus plans.
        </p>
      </header>

      {/* Perfil */}
      <section className="space-y-4">
        <h2 className="text-xs uppercase tracking-wide text-ink-soft flex items-center gap-2">
          <User className="h-4 w-4" strokeWidth={2} />
          Perfil
        </h2>
        <div className="rounded-xl border border-ink-faint/40 bg-cream-soft/40 p-5 space-y-2 text-sm">
          <div className="flex justify-between gap-4">
            <span className="text-ink-soft">Correu electrònic</span>
            <span className="text-ink font-medium">{user.email}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-ink-soft">Mètode d'entrada</span>
            <span className="text-ink">
              {provider === "google" ? "Google" : "Correu i contrasenya"}
            </span>
          </div>
        </div>
        {provider !== "google" && (
          <p className="text-xs text-ink-soft">
            Per canviar la contrasenya, surt i clica "Has oblidat la contrasenya?"
            al login (de moment, mentre no posem un canvi des d'aquí).
          </p>
        )}
      </section>

      {/* Plans propis */}
      <section className="space-y-4">
        <h2 className="text-xs uppercase tracking-wide text-ink-soft flex items-center gap-2">
          <Crown className="h-4 w-4" strokeWidth={2} />
          Plans propis ({ownedPlans?.length ?? 0})
        </h2>
        {ownedPlans && ownedPlans.length > 0 ? (
          <ul className="rounded-xl border border-ink-faint/40 divide-y divide-ink-faint/30 bg-cream-soft/40">
            {ownedPlans.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between gap-3 px-4 py-3 text-sm"
              >
                <Link
                  href={`/plans/${p.id}`}
                  className="text-ink hover:text-peach-deep truncate"
                >
                  {p.title}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-ink-soft">
            Encara no n'has creat cap.
          </p>
        )}
      </section>

      {/* Plans compartits */}
      <section className="space-y-4">
        <h2 className="text-xs uppercase tracking-wide text-ink-soft flex items-center gap-2">
          <Users className="h-4 w-4" strokeWidth={2} />
          Plans compartits ({guestPlans.length})
        </h2>
        {guestPlans.length > 0 ? (
          <ul className="rounded-xl border border-ink-faint/40 divide-y divide-ink-faint/30 bg-cream-soft/40">
            {guestPlans.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between gap-3 px-4 py-3 text-sm"
              >
                <Link
                  href={`/plans/${p.id}`}
                  className="text-ink hover:text-peach-deep truncate flex-1"
                >
                  {p.title}
                </Link>
                <LeavePlanButton planId={p.id} planTitle={p.title} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-ink-soft">
            No t'ha convidat ningu a cap pla.
          </p>
        )}
      </section>

      {/* Esborrar compte */}
      <section className="space-y-4 pt-6 border-t border-ink-faint/30">
        <h2 className="text-xs uppercase tracking-wide text-peach-deep">
          Zona perillosa
        </h2>
        <div className="rounded-xl border border-peach-deep/40 bg-peach-soft/30 p-5 space-y-3">
          <h3 className="text-ink font-semibold">Esborrar el compte</h3>
          <p className="text-sm text-ink-soft">
            Aquesta acció no es pot desfer. Esborrarem els plans on només hi
            ets tu. Els plans que comparteixes seguiran vius amb el primer
            co-editor com a propietari nou.
          </p>
          <DeleteAccountButton />
        </div>
      </section>
    </div>
  );
}
