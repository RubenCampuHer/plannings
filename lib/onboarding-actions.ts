"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createSupabaseServer } from "./supabase-server";

// Marca a l'usuari com "ja ha vist l'onboarding" via cookie. Si canvia browser
// el tornarà a veure — no és sensible, només una guia inicial.
async function markOnboarded() {
  const store = await cookies();
  store.set("plannings_onboarded", "1", {
    maxAge: 60 * 60 * 24 * 365, // 1 any
    httpOnly: false,
    sameSite: "lax",
    path: "/",
  });
}

export async function skipOnboarding(): Promise<void> {
  await markOnboarded();
  redirect("/");
}

export async function createDemoPlan(): Promise<void> {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const now = new Date().toISOString();
  const id = `benvinguda-${user.id.slice(0, 8)}`;

  const body = `## La idea

Aquest és un plan de prova per veure com funciona plannings. Esborra'l quan vulguis i comença el teu primer plan de debò.

## Què hi pots fer

- Escriure prosa lliure al cos, com en un diari
- Afegir llocs al mapa (cerca a la dreta)
- Llista de coses pendents (checklist)
- Pujar fotos i veure-les a l'àlbum
- Convidar persones al pla
- Demanar al copilot que t'ajudi a ampliar idees

## Pendents`;

  const { error: planError } = await supabase.from("plans").insert({
    id,
    title: "Benvinguda a plannings",
    type: "weekend",
    status: "planning",
    cover: "linear-gradient(135deg, #F4A26E 0%, #E27A45 45%, #6B97A8 100%)",
    destination: null,
    start_date: null,
    end_date: null,
    summary: "Un plan de mostra per veure les peces. Esborra'l quan ja en tinguis el primer de debò.",
    body,
    budget_total: null,
    budget_currency: null,
    parent_plan_id: null,
    owner_id: user.id,
    created_at: now,
    updated_at: now,
  });

  if (planError) {
    redirect(`/onboarding?error=${encodeURIComponent(planError.message)}`);
  }

  const { error: memberError } = await supabase
    .from("plan_members")
    .insert({ plan_id: id, user_id: user.id });

  if (memberError) {
    redirect(`/onboarding?error=${encodeURIComponent(memberError.message)}`);
  }

  // Uns quants checklist items per ensenyar la feature.
  await supabase.from("checklist_items").insert([
    { id: crypto.randomUUID(), plan_id: id, text: "Explorar el mapa", done: false },
    { id: crypto.randomUUID(), plan_id: id, text: "Pujar una foto", done: false },
    { id: crypto.randomUUID(), plan_id: id, text: "Provar el copilot", done: false },
    { id: crypto.randomUUID(), plan_id: id, text: "Crear el primer plan de debò", done: false },
  ]);

  await markOnboarded();
  redirect(`/plans/${id}`);
}
