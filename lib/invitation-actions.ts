"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServer } from "./supabase-server";
import type { PlanInvitation, PlanMember } from "./types";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function genToken(): string {
  // 32 caràcters alfanumèrics (~190 bits d'entropia). Sense guions per ser
  // amigable a URLs/copy-paste.
  return Array.from(crypto.getRandomValues(new Uint8Array(24)))
    .map((b) => b.toString(36).padStart(2, "0"))
    .join("")
    .slice(0, 32);
}

async function fetchAdminUserEmail(userId: string): Promise<string | null> {
  if (!SERVICE_KEY) return null;
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { email?: string };
  return data.email ?? null;
}

/** Membres d'un pla amb emails resolts. Només per al pla on l'usuari és member. */
export async function getPlanMembers(planId: string): Promise<PlanMember[]> {
  const supabase = await createSupabaseServer();

  const { data: plan } = await supabase
    .from("plans")
    .select("owner_id")
    .eq("id", planId)
    .single();
  if (!plan) return [];

  const { data: rows, error } = await supabase
    .from("plan_members")
    .select("user_id, joined_at")
    .eq("plan_id", planId);
  if (error || !rows) return [];

  // Resolem emails via admin API (service role). Si falla, posem 'unknown'.
  const members: PlanMember[] = await Promise.all(
    rows.map(async (r) => ({
      userId: r.user_id,
      email: (await fetchAdminUserEmail(r.user_id)) ?? "(email desconegut)",
      isOwner: r.user_id === plan.owner_id,
      joinedAt: r.joined_at,
    })),
  );
  // Owner primer.
  members.sort((a, b) => (a.isOwner === b.isOwner ? 0 : a.isOwner ? -1 : 1));
  return members;
}

/** Invitations pendents (no acceptades, no expirades) per a un pla. */
export async function getPendingInvitations(planId: string): Promise<PlanInvitation[]> {
  const supabase = await createSupabaseServer();
  const { data, error } = await supabase
    .from("plan_invitations")
    .select("id, email, token, expires_at, created_at")
    .eq("plan_id", planId)
    .is("accepted_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return data.map((r) => ({
    id: r.id,
    email: r.email,
    token: r.token,
    expiresAt: r.expires_at,
    createdAt: r.created_at,
  }));
}

export async function inviteToPlan(formData: FormData): Promise<void> {
  const planId = String(formData.get("planId") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!planId || !email) throw new Error("Falten dades.");

  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Cal estar autenticat.");

  const token = genToken();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const { error } = await supabase.from("plan_invitations").insert({
    plan_id: planId,
    email,
    token,
    invited_by: user.id,
    expires_at: expiresAt,
  });
  if (error) throw new Error(`Crear invitació: ${error.message}`);

  revalidatePath(`/plans/${planId}`);
}

export async function cancelInvitation(formData: FormData): Promise<void> {
  const planId = String(formData.get("planId") ?? "").trim();
  const invitationId = String(formData.get("invitationId") ?? "").trim();
  if (!planId || !invitationId) throw new Error("Falten dades.");

  const supabase = await createSupabaseServer();
  const { error } = await supabase
    .from("plan_invitations")
    .delete()
    .eq("id", invitationId)
    .eq("plan_id", planId);
  if (error) throw new Error(`Cancel·lar invitació: ${error.message}`);

  revalidatePath(`/plans/${planId}`);
}

export async function removeMember(formData: FormData): Promise<void> {
  const planId = String(formData.get("planId") ?? "").trim();
  const userId = String(formData.get("userId") ?? "").trim();
  if (!planId || !userId) throw new Error("Falten dades.");

  const supabase = await createSupabaseServer();
  const { data: plan } = await supabase
    .from("plans")
    .select("owner_id")
    .eq("id", planId)
    .single();
  if (!plan) throw new Error("Plan no trobat.");
  if (plan.owner_id === userId) {
    throw new Error("L'owner no es pot treure del seu propi pla.");
  }

  const { error } = await supabase
    .from("plan_members")
    .delete()
    .eq("plan_id", planId)
    .eq("user_id", userId);
  if (error) throw new Error(`Treure membre: ${error.message}`);

  revalidatePath(`/plans/${planId}`);
}

export async function leavePlan(formData: FormData): Promise<void> {
  const planId = String(formData.get("planId") ?? "").trim();
  if (!planId) throw new Error("Falten dades.");

  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Cal estar autenticat.");

  const { data: plan } = await supabase
    .from("plans")
    .select("owner_id")
    .eq("id", planId)
    .single();
  if (!plan) throw new Error("Plan no trobat.");
  if (plan.owner_id === user.id) {
    throw new Error(
      "Ets l'owner del pla. Esborra el pla en lloc de marxar.",
    );
  }

  const { error } = await supabase
    .from("plan_members")
    .delete()
    .eq("plan_id", planId)
    .eq("user_id", user.id);
  if (error) throw new Error(`Sortir del pla: ${error.message}`);

  redirect("/");
}

/**
 * Accepta una invitació: comprova token + email match, insereix plan_members,
 * marca accepted_at. Cridat des de /invite/[token] amb l'usuari autenticat.
 */
export async function acceptInvitationByToken(token: string): Promise<{
  planId: string;
} | { error: string }> {
  if (!SERVICE_KEY) return { error: "Server no configurat." };

  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Cal autenticar-se primer." };

  // Llegim la invitation. Pot ser que la policy del client no la deixi llegir
  // si l'email no és el seu — usem service role per a la verificació.
  const inviteRes = await fetch(
    `${SUPABASE_URL}/rest/v1/plan_invitations?token=eq.${encodeURIComponent(token)}&select=id,plan_id,email,expires_at,accepted_at`,
    {
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
    },
  );
  if (!inviteRes.ok) return { error: "No s'ha pogut llegir la invitació." };
  const invites = (await inviteRes.json()) as Array<{
    id: string;
    plan_id: string;
    email: string;
    expires_at: string;
    accepted_at: string | null;
  }>;
  const invite = invites[0];
  if (!invite) return { error: "Aquesta invitació no existeix o ha caducat." };
  if (invite.accepted_at) return { error: "Aquesta invitació ja ha estat usada." };
  if (new Date(invite.expires_at) < new Date()) {
    return { error: "Aquesta invitació ha expirat." };
  }
  if (user.email && invite.email.toLowerCase() !== user.email.toLowerCase()) {
    return {
      error: `Aquesta invitació és per a ${invite.email}. Entra amb aquell compte per acceptar-la.`,
    };
  }

  // Inserim plan_members amb service role (la policy d'inserció per auth
  // només admet self-insert quan ets owner del pla, que no és el cas aquí).
  const memberRes = await fetch(`${SUPABASE_URL}/rest/v1/plan_members`, {
    method: "POST",
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "resolution=ignore-duplicates",
    },
    body: JSON.stringify({ plan_id: invite.plan_id, user_id: user.id }),
  });
  if (!memberRes.ok) {
    return { error: "No s'ha pogut afegir al pla." };
  }

  // Marquem la invitation com acceptada.
  await fetch(
    `${SUPABASE_URL}/rest/v1/plan_invitations?id=eq.${invite.id}`,
    {
      method: "PATCH",
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ accepted_at: new Date().toISOString() }),
    },
  );

  revalidatePath(`/plans/${invite.plan_id}`);
  return { planId: invite.plan_id };
}
