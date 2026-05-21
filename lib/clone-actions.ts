"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServer } from "./supabase-server";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function genToken(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(24)))
    .map((b) => b.toString(36).padStart(2, "0"))
    .join("")
    .slice(0, 32);
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

/** Genera un slug nou no usat. Usa service role per veure tots els plans. */
async function uniqueSlugAdmin(base: string): Promise<string> {
  if (!SERVICE_KEY) throw new Error("Server no configurat.");
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/plans?id=like.${encodeURIComponent(base + "*")}&select=id`,
    { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } },
  );
  if (!res.ok) throw new Error("Comprovar slug ha fallat.");
  const rows = (await res.json()) as Array<{ id: string }>;
  const taken = new Set(rows.map((r) => r.id));
  if (!taken.has(base)) return base;
  for (let i = 2; i < 1000; i++) {
    const cand = `${base}-${i}`;
    if (!taken.has(cand)) return cand;
  }
  return `${base}-${Date.now()}`;
}

export async function generateShareToken(formData: FormData): Promise<void> {
  const planId = String(formData.get("planId") ?? "").trim();
  if (!planId) throw new Error("Falten dades.");

  const supabase = await createSupabaseServer();
  const token = genToken();
  const { error } = await supabase
    .from("plans")
    .update({ share_token: token })
    .eq("id", planId);
  if (error) throw new Error(`Generar token: ${error.message}`);

  revalidatePath(`/plans/${planId}`);
}

export async function revokeShareToken(formData: FormData): Promise<void> {
  const planId = String(formData.get("planId") ?? "").trim();
  if (!planId) throw new Error("Falten dades.");

  const supabase = await createSupabaseServer();
  const { error } = await supabase
    .from("plans")
    .update({ share_token: null })
    .eq("id", planId);
  if (error) throw new Error(`Revocar token: ${error.message}`);

  revalidatePath(`/plans/${planId}`);
}

type PlanRow = Record<string, unknown> & {
  id: string;
  title: string;
  type: string;
  status: string;
  cover: string;
  cover_image_path: string | null;
  destination: string | null;
  start_date: string | null;
  end_date: string | null;
  budget_total: number | null;
  budget_currency: string | null;
  summary: string;
  body: string;
  parent_plan_id: string | null;
  share_token: string | null;
};

async function adminGet<T>(path: string): Promise<T> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: SERVICE_KEY!, Authorization: `Bearer ${SERVICE_KEY}` },
  });
  if (!res.ok) throw new Error(`Admin GET ${path}: ${res.status} ${await res.text()}`);
  return res.json() as Promise<T>;
}

async function adminPost(path: string, body: unknown, prefer?: string): Promise<void> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method: "POST",
    headers: {
      apikey: SERVICE_KEY!,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      ...(prefer ? { Prefer: prefer } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Admin POST ${path}: ${res.status} ${await res.text()}`);
}

async function copyStorageObject(
  fromPath: string,
  toPath: string,
): Promise<void> {
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/copy`, {
    method: "POST",
    headers: {
      apikey: SERVICE_KEY!,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      bucketId: "plan-photos",
      sourceKey: fromPath,
      destinationKey: toPath,
    }),
  });
  if (!res.ok) {
    throw new Error(`Copy storage ${fromPath} → ${toPath}: ${await res.text()}`);
  }
}

/**
 * Duplica un pla per share_token: crea un nou pla amb el mateix contingut
 * (body, places, checklist, expenses, documents, photos amb storage copy)
 * però amb owner = current user, slug nou i sense parent_plan_id.
 */
export async function clonePlanByToken(token: string): Promise<{
  newPlanId: string;
} | { error: string }> {
  if (!SERVICE_KEY) return { error: "Server no configurat." };

  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Cal autenticar-se primer." };

  // Llegim el pla origen via service role (la RLS d'anon no el deixaria llegir
  // si l'usuari no és member).
  const plans = await adminGet<PlanRow[]>(
    `plans?share_token=eq.${encodeURIComponent(token)}&select=*`,
  );
  const source = plans[0];
  if (!source) return { error: "Aquest enllaç ja no és vàlid." };

  // Genera un slug nou. Mantenim el titol original (sense "(còpia)") perquè
  // l'usuari el reanomeni si vol.
  const base = slugify(source.title);
  const newId = await uniqueSlugAdmin(base);
  const now = new Date().toISOString();

  // 1) Còpia del pla. owner_id = user actual, parent buit, sense share_token
  //    (cadascú genera el seu).
  await adminPost(
    "plans",
    {
      id: newId,
      title: source.title,
      type: source.type,
      status: "planning",
      cover: source.cover,
      destination: source.destination,
      start_date: source.start_date,
      end_date: source.end_date,
      budget_total: source.budget_total,
      budget_currency: source.budget_currency,
      summary: source.summary,
      body: source.body,
      parent_plan_id: null,
      cover_image_path: null, // Reasignem si copiem el fitxer.
      owner_id: user.id,
      share_token: null,
      created_at: now,
      updated_at: now,
    },
  );

  // 2) plan_members (creator).
  await adminPost("plan_members", {
    plan_id: newId,
    user_id: user.id,
  });

  // 3) Cover image: si el pla original en té, copiem el fitxer i actualitzem
  //    cover_image_path del nou pla.
  if (source.cover_image_path) {
    const oldPath = source.cover_image_path;
    // El path comença amb el plan_id origen — el reescrivim al nou.
    const newPath = oldPath.replace(
      new RegExp(`^${source.id}/`),
      `${newId}/`,
    );
    try {
      await copyStorageObject(oldPath, newPath);
      await fetch(
        `${SUPABASE_URL}/rest/v1/plans?id=eq.${newId}`,
        {
          method: "PATCH",
          headers: {
            apikey: SERVICE_KEY!,
            Authorization: `Bearer ${SERVICE_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ cover_image_path: newPath }),
        },
      );
    } catch (e) {
      // Si la cover falla, no anul·lem la clonació — el pla ja existeix.
      console.error("[clone] cover copy failed:", e);
    }
  }

  // 4) Places.
  const places = await adminGet<Array<Record<string, unknown>>>(
    `places?plan_id=eq.${source.id}&select=*`,
  );
  if (places.length > 0) {
    await adminPost(
      "places",
      places.map((p) => ({
        ...p,
        id: crypto.randomUUID(),
        plan_id: newId,
      })),
    );
  }

  // 5) Checklist.
  const checklist = await adminGet<Array<Record<string, unknown>>>(
    `checklist_items?plan_id=eq.${source.id}&select=*`,
  );
  if (checklist.length > 0) {
    await adminPost(
      "checklist_items",
      checklist.map((c) => ({
        ...c,
        id: crypto.randomUUID(),
        plan_id: newId,
      })),
    );
  }

  // 6) Expenses.
  const expenses = await adminGet<Array<Record<string, unknown>>>(
    `expenses?plan_id=eq.${source.id}&select=*`,
  );
  if (expenses.length > 0) {
    await adminPost(
      "expenses",
      expenses.map((e) => ({
        ...e,
        id: crypto.randomUUID(),
        plan_id: newId,
      })),
    );
  }

  // 7) Documents (metadata only — els fitxers físics els deixem fora de
  //    l'abast per ara).
  const docs = await adminGet<Array<Record<string, unknown>>>(
    `plan_documents?plan_id=eq.${source.id}&select=*`,
  );
  if (docs.length > 0) {
    await adminPost(
      "plan_documents",
      docs.map((d) => ({
        ...d,
        id: crypto.randomUUID(),
        plan_id: newId,
      })),
    );
  }

  // 8) Photos: per cada foto del pla origen, copiem el fitxer al nou path
  //    i creem una entrada nova a plan_photos.
  const photos = await adminGet<
    Array<{
      id: string;
      caption: string | null;
      gradient: string | null;
      taken_at: string | null;
      storage_path: string | null;
      mime_type: string | null;
    }>
  >(
    `plan_photos?plan_id=eq.${source.id}&select=id,caption,gradient,taken_at,storage_path,mime_type`,
  );

  if (photos.length > 0) {
    const photoInserts: Array<Record<string, unknown>> = [];
    for (const ph of photos) {
      let newStoragePath: string | null = null;
      if (ph.storage_path) {
        newStoragePath = ph.storage_path.replace(
          new RegExp(`^${source.id}/`),
          `${newId}/`,
        );
        try {
          await copyStorageObject(ph.storage_path, newStoragePath);
        } catch (e) {
          console.error("[clone] photo copy failed:", e);
          newStoragePath = null; // Si la còpia falla, deixem la foto sense path.
        }
      }
      photoInserts.push({
        id: crypto.randomUUID(),
        plan_id: newId,
        caption: ph.caption,
        gradient: ph.gradient,
        taken_at: ph.taken_at,
        storage_path: newStoragePath,
        mime_type: ph.mime_type,
      });
    }
    await adminPost("plan_photos", photoInserts);
  }

  return { newPlanId: newId };
}
