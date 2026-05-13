"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServer } from "./supabase-server";

/**
 * Registra una imatge de portada nova després de pujar-la al bucket des del client.
 * Si el plan ja en tenia, esborra el fitxer antic del storage abans d'actualitzar la DB.
 */
export async function setCoverImage(
  planId: string,
  storagePath: string,
): Promise<void> {
  const supabase = await createSupabaseServer();

  // Recuperem el path anterior per esborrar-lo del storage després.
  const { data: prev } = await supabase
    .from("plans")
    .select("cover_image_path")
    .eq("id", planId)
    .maybeSingle();
  const previousPath = (prev?.cover_image_path as string | null | undefined) ?? null;

  const { error } = await supabase
    .from("plans")
    .update({ cover_image_path: storagePath, updated_at: new Date().toISOString() })
    .eq("id", planId);
  if (error) throw new Error(`Actualitzar portada: ${error.message}`);

  // Esborrem la imatge antiga després del DB perquè si fallés la DB no perdem el fitxer.
  if (previousPath && previousPath !== storagePath) {
    await supabase.storage.from("plan-photos").remove([previousPath]);
  }

  revalidatePath("/");
  revalidatePath("/archive");
  revalidatePath(`/plans/${planId}`);
  revalidatePath(`/plans/${planId}/edit`);
}

/** Treu la imatge de portada (torna al degradat). */
export async function clearCoverImage(planId: string): Promise<void> {
  const supabase = await createSupabaseServer();

  const { data: prev } = await supabase
    .from("plans")
    .select("cover_image_path")
    .eq("id", planId)
    .maybeSingle();
  const previousPath = (prev?.cover_image_path as string | null | undefined) ?? null;
  if (!previousPath) return;

  const { error } = await supabase
    .from("plans")
    .update({ cover_image_path: null, updated_at: new Date().toISOString() })
    .eq("id", planId);
  if (error) throw new Error(`Treure portada: ${error.message}`);

  await supabase.storage.from("plan-photos").remove([previousPath]);

  revalidatePath("/");
  revalidatePath("/archive");
  revalidatePath(`/plans/${planId}`);
  revalidatePath(`/plans/${planId}/edit`);
}
