"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { applyAiPlaceSuggestions, type SuggestedPlace } from "./ai-actions";
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
  const parentPlanIdRaw = String(fd.get("parentPlanId") ?? "").trim();

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
    parent_plan_id: parentPlanIdRaw || null,
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
  // Els sub-plans (fills) queden orfes per ON DELETE SET NULL al parent_plan_id.
  const supabase = await createSupabaseServer();

  // Recuperem el pare per refrescar-li la card de sub-plans, i decidir on
  // redirigir si aquest plan era un fill.
  const { data: existing } = await supabase
    .from("plans")
    .select("parent_plan_id")
    .eq("id", id)
    .maybeSingle();
  const parentId = (existing?.parent_plan_id as string | null | undefined) ?? null;

  const { error } = await supabase.from("plans").delete().eq("id", id);
  if (error) throw new Error(`Esborrar plan ${id}: ${error.message}`);

  revalidatePath("/");
  revalidatePath("/archive");
  if (parentId) revalidatePath(`/plans/${parentId}`);
  redirect(parentId ? `/plans/${parentId}` : "/");
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

/**
 * Updates ràpids d'un sol camp des de l'edició inline al detall.
 * Eviten el cicle complet de /edit + redirect.
 */
export async function updatePlanSummary(
  planId: string,
  summary: string,
): Promise<void> {
  const trimmed = summary.trim();
  if (!trimmed) throw new Error("El resum no pot estar buit.");
  const supabase = await createSupabaseServer();
  const { error } = await supabase
    .from("plans")
    .update({ summary: trimmed, updated_at: new Date().toISOString() })
    .eq("id", planId);
  if (error) throw new Error(`Actualitzar resum: ${error.message}`);
  revalidatePath("/");
  revalidatePath(`/plans/${planId}`);
  revalidatePath(`/plans/${planId}/edit`);
}

export async function updatePlanBody(
  planId: string,
  body: string,
): Promise<void> {
  const trimmed = body.trim();
  if (!trimmed) throw new Error("El cos del plan no pot estar buit.");
  const supabase = await createSupabaseServer();
  const { error } = await supabase
    .from("plans")
    .update({ body: trimmed, updated_at: new Date().toISOString() })
    .eq("id", planId);
  if (error) throw new Error(`Actualitzar cos: ${error.message}`);
  revalidatePath(`/plans/${planId}`);
  revalidatePath(`/plans/${planId}/edit`);
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
  if (fields.parent_plan_id) revalidatePath(`/plans/${fields.parent_plan_id}`);
  redirect(target);
}

/**
 * Parsejat tolerant del JSON dels pending del Polish IA. Si el camp ve buit,
 * mal format, o és array de tipus incorrecte, retornem buit i seguim — no és
 * crític que els suggeriments arribin: el plan s'ha de crear igualment.
 */
function parsePendingPlaces(raw: FormDataEntryValue | null): SuggestedPlace[] {
  if (typeof raw !== "string" || raw === "" || raw === "[]") return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (p): p is SuggestedPlace =>
          typeof p === "object" &&
          p !== null &&
          typeof (p as { name?: unknown }).name === "string" &&
          typeof (p as { searchQuery?: unknown }).searchQuery === "string",
      )
      .map((p) => ({ name: p.name, searchQuery: p.searchQuery, why: p.why }));
  } catch {
    return [];
  }
}

function parsePendingChecklist(raw: FormDataEntryValue | null): string[] {
  if (typeof raw !== "string" || raw === "" || raw === "[]") return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((t): t is string => typeof t === "string" && t.trim() !== "");
  } catch {
    return [];
  }
}

export async function createPlan(formData: FormData): Promise<void> {
  const fields = readPlanForm(formData);
  const pendingPlaces = parsePendingPlaces(formData.get("pendingPlacesJson"));
  const pendingChecklist = parsePendingChecklist(formData.get("pendingChecklistJson"));

  // M12: quota de plans pare (assertCanCreatePlan) pendent de reintegrar amb quota-actions.

  const base = slugify(fields.title);
  const id = await uniqueSlug(base);
  const now = new Date().toISOString();

  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Cal estar autenticat per crear un plan.");

  const { error } = await supabase.from("plans").insert({
    id,
    ...fields,
    owner_id: user.id,
    created_at: now,
    updated_at: now,
  });
  if (error) throw new Error(`Crear plan: ${error.message}`);

  const { error: memberError } = await supabase
    .from("plan_members")
    .insert({ plan_id: id, user_id: user.id });
  if (memberError) throw new Error(`Afegir creator com a member: ${memberError.message}`);

  // Checklist primer (instantani). Si falla no anul·lem el create — el plan
  // ja existeix i l'usuari pot afegir els items a mà.
  if (pendingChecklist.length > 0) {
    const rows = pendingChecklist.map((text) => ({
      id: crypto.randomUUID(),
      plan_id: id,
      text,
      done: false,
    }));
    await supabase.from("checklist_items").insert(rows);
  }

  // Places: geocode + insert (lent — ~1.1s per lloc).
  if (pendingPlaces.length > 0) {
    try {
      await applyAiPlaceSuggestions(id, pendingPlaces);
    } catch {
      // Errors de geocoding no haurien d'evitar el redirect al plan creat.
    }
  }

  revalidatePath("/");
  revalidatePath("/archive");
  if (fields.parent_plan_id) revalidatePath(`/plans/${fields.parent_plan_id}`);
  redirect(`/plans/${id}`);
}
