"use server";

import { redirect } from "next/navigation";
import { createSupabaseServer } from "./supabase-server";

function parseCredentials(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  return { email, password };
}

export async function signInWithPassword(formData: FormData): Promise<void> {
  const { email, password } = parseCredentials(formData);
  if (!email || !password) {
    redirect("/login?mode=signin&error=missing_fields");
  }

  const supabase = await createSupabaseServer();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect(`/login?mode=signin&error=${encodeURIComponent(error.message)}`);
  }

  redirect("/");
}

export async function signUpWithPassword(formData: FormData): Promise<void> {
  const { email, password } = parseCredentials(formData);
  const inviteCode = String(formData.get("inviteCode") ?? "").trim();
  if (!email || !password) {
    redirect("/login?mode=signup&error=missing_fields");
  }
  if (password.length < 6) {
    redirect("/login?mode=signup&error=short_password");
  }
  if (!inviteCode) {
    redirect("/login?mode=signup&error=missing_invite_code");
  }

  // Validem el codi server-side abans de tocar Supabase. Si encaixa, afegim
  // l'email a beta_invites perquè el trigger d'auth el deixi passar.
  const expectedCode = process.env.BETA_INVITE_CODE;
  if (!expectedCode || inviteCode !== expectedCode) {
    redirect("/login?mode=signup&error=invalid_invite_code");
  }

  // L'INSERT a beta_invites el fem amb service role (server-side, key no
  // exposada al client) perquè la RLS de beta_invites no permet escriptura
  // anònima. Així el trigger d'auth ja troba l'email i deixa passar el signUp.
  const adminUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    redirect("/login?mode=signup&error=server_misconfigured");
  }
  const claimRes = await fetch(`${adminUrl}/rest/v1/beta_invites`, {
    method: "POST",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
      Prefer: "resolution=ignore-duplicates",
    },
    body: JSON.stringify({
      email: email.toLowerCase(),
      note: "Beta code signup",
    }),
  });
  if (!claimRes.ok) {
    const body = await claimRes.text();
    redirect(`/login?mode=signup&error=${encodeURIComponent(body || "beta_claim_failed")}`);
  }

  const supabase = await createSupabaseServer();
  const { data, error } = await supabase.auth.signUp({ email, password });

  if (error) {
    // El trigger de whitelist a la BD també arriba aquí amb el seu missatge.
    redirect(`/login?mode=signup&error=${encodeURIComponent(error.message)}`);
  }

  // Si Supabase té "Confirm email" activat, no hi ha sessió fins que cliquin el correu.
  if (!data.session) {
    redirect(`/login?mode=signin&confirm=${encodeURIComponent(email)}`);
  }

  redirect("/");
}

export async function signOut(): Promise<void> {
  const supabase = await createSupabaseServer();
  await supabase.auth.signOut();
  redirect("/login");
}

