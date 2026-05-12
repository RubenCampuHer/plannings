"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServer } from "./supabase-server";
import type { PlanStatus, PlanType } from "./types";

const PLAN_TYPES: PlanType[] = ["deep", "weekend", "day"];
const PLAN_STATUSES: PlanStatus[] = ["planning", "active", "completed", "archived"];

function readPlanForm(fd: FormData) {
  const title = String(fd.get("title") ?? "").trim();
  const type = String(fd.get("type") ?? "");
  const status = String(fd.get("status") ?? "");
  const cover = String(fd.get("cover") ?? "").trim();
  const destination = String(fd.get("destination") ?? "").trim();
  const startDate = String(fd.get("startDate") ?? "").trim();
  const endDate = String(fd.get("endDate") ?? "").trim();
  const budgetTotalRaw = String(fd.get("budgetTotal") ?? "").trim();
  const budgetCurrency = String(fd.get("budgetCurrency") ?? "").trim();
  const summary = String(fd.get("summary") ?? "").trim();
  const body = String(fd.get("body") ?? "").trim();

  if (!title) throw new Error("El títol és obligatori.");
  if (!summary) throw new Error("El resum és obligatori.");
  if (!body) throw new Error("El cos del plan és obligatori.");
  if (!cover) throw new Error("Falta el degradat de portada.");
  if (!PLAN_TYPES.includes(type as PlanType)) throw new Error("Tipus no vàlid.");
  if (!PLAN_STATUSES.includes(status as PlanStatus)) throw new Error("Estat no vàlid.");
  if (startDate && endDate && startDate > endDate) {
    throw new Error("La data d'inici no pot ser posterior a la de fi.");
  }

  // Plans de dia: una sola data. Si arriba només startDate, igualem endDate.
  const isDay = type === "day";
  const dayStart = isDay ? (startDate || null) : (startDate || null);
  const dayEnd = isDay ? (startDate || null) : (endDate || null);

  const budgetTotal = budgetTotalRaw ? Number(budgetTotalRaw) : null;
  if (budgetTotal != null && (Number.isNaN(budgetTotal) || budgetTotal < 0)) {
    throw new Error("Pressupost no vàlid.");
  }

  return {
    title,
    type: type as PlanType,
    status: status as PlanStatus,
    cover,
    destination: destination || null,
    start_date: dayStart,
    end_date: dayEnd,
    budget_total: budgetTotal,
    budget_currency: budgetTotal != null ? budgetCurrency || "EUR" : null,
    summary,
    body,
  };
}

function slugify(input: string): string {
  const ascii = input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return ascii || "plan";
}

async function uniqueSlug(base: string): Promise<string> {
  const supabase = await createSupabaseServer();
  const { data, error } = await supabase
    .from("plans")
    .select("id")
    .like("id", `${base}%`);
  if (error) throw new Error(`Comprovar slug: ${error.message}`);
  const taken = new Set((data ?? []).map((r) => r.id as string));
  if (!taken.has(base)) return base;
  for (let i = 2; i < 1000; i++) {
    const candidate = `${base}-${i}`;
    if (!taken.has(candidate)) return candidate;
  }
  return `${base}-${Date.now()}`;
}

export async function archivePlan(id: string): Promise<void> {
  const supabase = await createSupabaseServer();
  const { error } = await supabase
    .from("plans")
    .update({ status: "archived", updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(`Arxivar plan ${id}: ${error.message}`);

  revalidatePath("/");
  revalidatePath("/archive");
  revalidatePath(`/plans/${id}`);
  redirect("/archive");
}

export async function deletePlan(id: string): Promise<void> {
  // Les taules relacionades cauen per ON DELETE CASCADE.
  const supabase = await createSupabaseServer();
  const { error } = await supabase.from("plans").delete().eq("id", id);
  if (error) throw new Error(`Esborrar plan ${id}: ${error.message}`);

  revalidatePath("/");
  revalidatePath("/archive");
  redirect("/");
}

export async function unarchivePlan(id: string): Promise<void> {
  const supabase = await createSupabaseServer();
  const { error } = await supabase
    .from("plans")
    .update({ status: "planning", updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(`Desarxivar plan ${id}: ${error.message}`);

  revalidatePath("/");
  revalidatePath("/archive");
  revalidatePath(`/plans/${id}`);
  redirect(`/plans/${id}`);
}

export async function updatePlan(id: string, formData: FormData): Promise<void> {
  const fields = readPlanForm(formData);
  const supabase = await createSupabaseServer();
  const { error } = await supabase
    .from("plans")
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(`Actualitzar plan ${id}: ${error.message}`);

  const target = fields.status === "archived" ? "/archive" : `/plans/${id}`;
  revalidatePath("/");
  revalidatePath("/archive");
  revalidatePath(`/plans/${id}`);
  redirect(target);
}

export async function createPlan(formData: FormData): Promise<void> {
  const fields = readPlanForm(formData);
  const base = slugify(fields.title);
  const id = await uniqueSlug(base);
  const now = new Date().toISOString();

  const supabase = await createSupabaseServer();
  const { error } = await supabase.from("plans").insert({
    id,
    ...fields,
    created_at: now,
    updated_at: now,
  });
  if (error) throw new Error(`Crear plan: ${error.message}`);

  revalidatePath("/");
  revalidatePath("/archive");
  redirect(`/plans/${id}`);
}
