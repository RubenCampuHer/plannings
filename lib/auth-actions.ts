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
  if (!email || !password) {
    redirect("/login?mode=signup&error=missing_fields");
  }
  if (password.length < 6) {
    redirect("/login?mode=signup&error=short_password");
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

