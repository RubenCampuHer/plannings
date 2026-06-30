"use server";

import { revalidatePath } from "next/cache";
import { assertCanAddPhoto } from "./quota-actions";
import { createSupabaseServer } from "./supabase-server";

/**
 * Registra una foto a la DB després d'haver-la pujada al bucket des del client.
 * Patró: client puja directament a Storage (evita el límit d'1MB dels server actions);
 * després crida aquesta acció amb el storage_path per inserir la row.
 */
export async function registerPhoto(
  planId: string,
  photoId: string,
  storagePath: string,
  mimeType: string,
  caption?: string,
): Promise<void> {
  await assertCanAddPhoto(planId);
  const supabase = await createSupabaseServer();
  const { error } = await supabase.from("plan_photos").insert({
    id: photoId,
    plan_id: planId,
    storage_path: storagePath,
    mime_type: mimeType,
    caption: caption ?? null,
  });
  if (error) throw new Error(`Registrar foto: ${error.message}`);
  revalidatePath(`/plans/${planId}`);
}

export async function deletePhoto(planId: string, photoId: string): Promise<void> {
  const supabase = await createSupabaseServer();

  // Necessitem el storage_path per esborrar el fitxer del bucket.
  const { data: photo, error: fetchError } = await supabase
    .from("plan_photos")
    .select("storage_path")
    .eq("id", photoId)
    .eq("plan_id", planId)
    .maybeSingle();
  if (fetchError) throw new Error(`Llegir foto: ${fetchError.message}`);

  const storagePath = (photo?.storage_path as string | null | undefined) ?? null;

  const { error: dbError } = await supabase
    .from("plan_photos")
    .delete()
    .eq("id", photoId)
    .eq("plan_id", planId);
  if (dbError) throw new Error(`Esborrar foto (DB): ${dbError.message}`);

  // Esborrem el fitxer després del registre DB perquè si fallés el DB, no perdem
  // el fitxer; si falla l'storage però sí el DB, només queda un fitxer orfe que
  // no fa mal (el bucket és privat i sense referències a la DB ningú el veurà).
  if (storagePath) {
    await supabase.storage.from("plan-photos").remove([storagePath]);
  }

  revalidatePath(`/plans/${planId}`);
}
