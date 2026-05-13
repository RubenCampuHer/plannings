"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServer } from "./supabase-server";

export async function addChecklistItem(
  planId: string,
  text: string,
): Promise<{ id: string }> {
  const trimmed = text.trim();
  if (!trimmed) throw new Error("L'item no pot estar buit");

  const supabase = await createSupabaseServer();
  const id = crypto.randomUUID();
  const { error } = await supabase.from("checklist_items").insert({
    id,
    plan_id: planId,
    text: trimmed,
    done: false,
  });
  if (error) throw new Error(`Afegir item: ${error.message}`);

  revalidatePath(`/plans/${planId}`);
  return { id };
}

export async function toggleChecklistItem(
  planId: string,
  itemId: string,
  done: boolean,
): Promise<void> {
  const supabase = await createSupabaseServer();
  const { error } = await supabase
    .from("checklist_items")
    .update({ done })
    .eq("id", itemId)
    .eq("plan_id", planId);
  if (error) throw new Error(`Actualitzar item: ${error.message}`);

  revalidatePath(`/plans/${planId}`);
}

export async function deleteChecklistItem(
  planId: string,
  itemId: string,
): Promise<void> {
  const supabase = await createSupabaseServer();
  const { error } = await supabase
    .from("checklist_items")
    .delete()
    .eq("id", itemId)
    .eq("plan_id", planId);
  if (error) throw new Error(`Esborrar item: ${error.message}`);

  revalidatePath(`/plans/${planId}`);
}
