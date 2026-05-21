"use server";

import { redirect } from "next/navigation";
import { createSupabaseServer } from "./supabase-server";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function adminGet<T>(path: string): Promise<T> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: SERVICE_KEY!, Authorization: `Bearer ${SERVICE_KEY}` },
  });
  if (!res.ok) throw new Error(`Admin GET ${path}: ${res.status} ${await res.text()}`);
  return res.json() as Promise<T>;
}

async function adminPatch(path: string, body: unknown): Promise<void> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method: "PATCH",
    headers: {
      apikey: SERVICE_KEY!,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Admin PATCH ${path}: ${res.status} ${await res.text()}`);
}

async function adminDelete(path: string): Promise<void> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method: "DELETE",
    headers: { apikey: SERVICE_KEY!, Authorization: `Bearer ${SERVICE_KEY}` },
  });
  if (!res.ok) throw new Error(`Admin DELETE ${path}: ${res.status} ${await res.text()}`);
}

/**
 * Esborra el compte de l'usuari autenticat:
 * 1) Per cada pla on és owner:
 *    - Si té co-membres → transferir ownership al membre més antic (no-owner).
 *    - Si no → esborrar el pla (cascade fa la resta).
 * 2) Esborrar el row d'auth.users via Supabase admin API.
 *    Això fa cascade a plan_members (FK ON DELETE CASCADE).
 * 3) Sign-out + redirect a /login.
 *
 * NOTA: els fitxers del bucket plan-photos no es netegen explícitament. Quedaran
 * orfes als plans que esborrem aquí. Es resoldrà en una neteja batch quan calgui.
 */
export async function deleteAccount(): Promise<void> {
  if (!SERVICE_KEY) throw new Error("Server no configurat.");

  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // 1) Plans on l'usuari és owner.
  const ownedPlans = await adminGet<Array<{ id: string }>>(
    `plans?owner_id=eq.${user!.id}&select=id`,
  );

  for (const plan of ownedPlans) {
    // Trobar co-membres (qualsevol membre que no sigui l'owner actual).
    const coMembers = await adminGet<Array<{ user_id: string; joined_at: string }>>(
      `plan_members?plan_id=eq.${plan.id}&user_id=neq.${user!.id}&select=user_id,joined_at&order=joined_at.asc`,
    );

    if (coMembers.length > 0) {
      // Transferir ownership al més antic.
      await adminPatch(
        `plans?id=eq.${plan.id}`,
        { owner_id: coMembers[0].user_id },
      );
    } else {
      // Sense co-membres: esborrar el pla. El cascade s'encarrega de places,
      // checklist, expenses, plan_documents, plan_photos, plan_members,
      // plan_messages, plan_invitations.
      await adminDelete(`plans?id=eq.${plan.id}`);
    }
  }

  // 2) Esborrar l'usuari d'auth.users via admin API.
  const res = await fetch(
    `${SUPABASE_URL}/auth/v1/admin/users/${user!.id}`,
    {
      method: "DELETE",
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
      },
    },
  );
  if (!res.ok) {
    throw new Error(`Esborrar usuari: ${res.status} ${await res.text()}`);
  }

  // 3) Tanca la sessió i envia a /login.
  await supabase.auth.signOut();
  redirect("/login?account_deleted=1");
}
