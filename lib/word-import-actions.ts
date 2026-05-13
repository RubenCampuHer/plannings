"use server";

import mammoth from "mammoth";
import { GoogleGenAI, Type } from "@google/genai";
import { revalidatePath } from "next/cache";
import { geocodeSearch } from "./place-actions";
import { createSupabaseServer } from "./supabase-server";
import type { PlanType } from "./types";

const apiKey = process.env.GOOGLE_AI_API_KEY;
const PLAN_TYPES: PlanType[] = ["deep", "weekend", "day"];

const PLACE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    name: {
      type: Type.STRING,
      description: "Nom curt del lloc (ex: 'Bangkok', 'Wat Pho').",
    },
    search_query: {
      type: Type.STRING,
      description:
        "Query precisa per Nominatim/OpenStreetMap (inclou ciutat i país sempre que sigui possible, ex: 'Wat Pho Bangkok Thailand').",
    },
  },
  required: ["name", "search_query"],
};

const BODY_DESCRIPTION = `Cos en Markdown formatat per llegir-se com a diari personal:
- Seccions amb ## (títol de secció) i ### per sub-seccions quan calgui.
- Aplica **negretes** a noms propis importants (ciutats, monuments, restaurants concrets) i conceptes clau.
- *Cursives* per a matisos, frases citades, èmfasi suau.
- Llistes amb - per a items, llistes numerades amb 1. quan hi hagi ordre.
- > blockquotes per a frases memorables, cites o consells importants.
- NO usis taules. NO posis tot en negreta — ha de respirar.
- To càlid en primera persona del plural ("anem", "fem"), com si l'usuari prengués notes per a si mateix.`;

// Esquema estructurat per a la resposta de Gemini.
const ANALYSIS_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    parent: {
      type: Type.OBJECT,
      description:
        "El plan pare. Si el document és un sol pla sense sub-divisions, children pot ser una llista buida.",
      properties: {
        title: {
          type: Type.STRING,
          description: "Títol curt del plan global (3-8 paraules).",
        },
        type: {
          type: Type.STRING,
          description: "Un de: deep, weekend, day. Per a un viatge llarg usar 'deep'.",
        },
        destination: {
          type: Type.STRING,
          description:
            "Destinació global (ex: 'Sud-est asiàtic · Austràlia'). Pot incloure varis territoris.",
        },
        summary: {
          type: Type.STRING,
          description: "Resum d'1-2 frases per la targeta del plan.",
        },
        body: {
          type: Type.STRING,
          description: BODY_DESCRIPTION,
        },
        startDate: {
          type: Type.STRING,
          description:
            "Data d'inici en format YYYY-MM-DD si el doc en menciona alguna. Si no, deixar buit.",
        },
        endDate: {
          type: Type.STRING,
          description:
            "Data de fi en format YYYY-MM-DD si el doc en menciona alguna. Si no, deixar buit.",
        },
        checklist: {
          type: Type.ARRAY,
          description:
            "Items pràctics GENERALS del viatge (visats múltiples, vacunes, vols intercontinentals, assegurança, passaport). NO items específics d'un país concret.",
          items: { type: Type.STRING },
        },
        places: {
          type: Type.ARRAY,
          description:
            "Llocs d'overview del viatge global: capitals, punts d'entrada, parades clau a nivell de país. Si el viatge té sub-plans, aquí van llocs estructurals (no detallats per ciutat — això va als fills). Si és un viatge sense sub-plans, aquí van tots els llocs.",
          items: PLACE_SCHEMA,
        },
      },
      required: ["title", "type", "summary", "body", "checklist", "places"],
    },
    children: {
      type: Type.ARRAY,
      description:
        "Sub-plans per regió/país si el document té una estructura clara amb seccions per destinació. Llista buida si no n'hi ha o si és un sol plan.",
      items: {
        type: Type.OBJECT,
        properties: {
          title: {
            type: Type.STRING,
            description: "Títol del sub-plan (ex: 'Tailàndia (3 setmanes)').",
          },
          type: {
            type: Type.STRING,
            description: "Un de: deep, weekend, day.",
          },
          destination: {
            type: Type.STRING,
            description: "Destinació del sub-plan (ex: 'Tailàndia').",
          },
          summary: {
            type: Type.STRING,
            description: "Resum d'1-2 frases.",
          },
          body: {
            type: Type.STRING,
            description: BODY_DESCRIPTION,
          },
          startDate: {
            type: Type.STRING,
            description: "YYYY-MM-DD si el doc el menciona, si no buit.",
          },
          endDate: {
            type: Type.STRING,
            description: "YYYY-MM-DD si el doc el menciona, si no buit.",
          },
          checklist: {
            type: Type.ARRAY,
            description:
              "Items específics d'aquesta regió (visat del país, transport intern, etc).",
            items: { type: Type.STRING },
          },
          places: {
            type: Type.ARRAY,
            description:
              "Llocs específics d'aquesta regió: ciutats, restaurants, monuments, platges... 5-15 segons la mida de la secció. Search queries precises perquè Nominatim els trobi.",
            items: PLACE_SCHEMA,
          },
        },
        required: ["title", "type", "summary", "body", "checklist", "places"],
      },
    },
  },
  required: ["parent", "children"],
};

export type WordPlaceSuggestion = {
  name: string;
  searchQuery: string;
};

export type WordAnalysis = {
  parent: {
    title: string;
    type: PlanType;
    destination?: string;
    summary: string;
    body: string;
    startDate?: string;
    endDate?: string;
    checklist: string[];
    places: WordPlaceSuggestion[];
  };
  children: Array<{
    title: string;
    type: PlanType;
    destination?: string;
    summary: string;
    body: string;
    startDate?: string;
    endDate?: string;
    checklist: string[];
    places: WordPlaceSuggestion[];
  }>;
};

function getClient(): GoogleGenAI {
  if (!apiKey) {
    throw new Error("Falta GOOGLE_AI_API_KEY a .env.local.");
  }
  return new GoogleGenAI({ apiKey });
}

function normalizeType(t: string): PlanType {
  return PLAN_TYPES.includes(t as PlanType) ? (t as PlanType) : "deep";
}

function emptyToUndef(s: string | undefined): string | undefined {
  return s && s.trim().length > 0 ? s.trim() : undefined;
}

/**
 * Pas 1: rep el .docx i en treu una estructura analitzada per Gemini.
 * No persisteix res — només retorna la proposta perquè l'usuari la revisi.
 */
export async function analyzeWordDocument(
  formData: FormData,
): Promise<WordAnalysis> {
  const file = formData.get("file");
  if (!(file instanceof File)) {
    throw new Error("Cap fitxer rebut.");
  }
  if (!file.name.toLowerCase().endsWith(".docx")) {
    throw new Error("Només .docx (no .doc ni altres formats).");
  }

  const bytes = await file.arrayBuffer();
  const { value: text } = await mammoth.extractRawText({
    buffer: Buffer.from(bytes),
  });

  if (!text || text.trim().length < 50) {
    throw new Error(
      "El document està buit o té massa poc contingut per analitzar.",
    );
  }

  // Gemini 2.5 Flash accepta fins a 1M tokens (~4M caràcters). No tallem el text:
  // un doc de 53 pàgs dens ronda els 100k caràcters i hi cap de sobres.

  const systemInstruction = `Ets un assistent que ajuda a importar plans de viatge des de documents Word a una agenda íntima en català.

Regles:
- Llegeix el document complet i decideix si és UN SOL plan (curt, focat) o un PLAN PARE amb SUB-PLANS (viatge llarg amb seccions per país o regió).
- Si detectes clarament seccions per país/regió (ex: "Tailàndia", "Vietnam"...), retorna parent + children, un fill per cada regió.
- Si el document és més curt o focat (un cap de setmana, un dia), retorna nomes parent amb children=[].
- Tots els textos en CATALÀ, primera persona del plural ("anem", "fem"), to càlid i personal — no corporatiu.
- Cos del pare: visió general, etapes, logística GENERAL. Sense duplicar info dels fills.
- Cos dels fills: específic del país/regió. Seccions ## per dies/temes.
- Checklist del pare: items GLOBALS (visat múltiple, vacunes, vols intercontinentals).
- Checklist dels fills: items específics del país (visat local, transport intern).
- Dates: només si surten clarament al document. Format ISO YYYY-MM-DD.
- Respon SEMPRE seguint l'esquema JSON. No afegeixis text fora.`;

  const client = getClient();
  let response;
  try {
    response = await client.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `Document Word a importar:

\`\`\`
${text}
\`\`\`

Analitza i retorna l'estructura (parent + children).`,
            },
          ],
        },
      ],
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: ANALYSIS_SCHEMA,
        temperature: 0.4,
      },
    });
  } catch (e) {
    const raw = e instanceof Error ? e.message : String(e);
    throw new Error(`Gemini ha fallat: ${raw.slice(0, 200)}`);
  }

  const raw = response.text;
  if (!raw) throw new Error("La IA no ha tornat resposta.");

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Resposta de la IA no és JSON vàlid.");
  }

  function parsePlaces(raw: unknown): WordPlaceSuggestion[] {
    if (!Array.isArray(raw)) return [];
    return raw
      .map((p: unknown) => {
        if (typeof p !== "object" || !p) return null;
        const obj = p as Record<string, unknown>;
        const name = String(obj.name ?? "").trim();
        const sq = String(obj.search_query ?? "").trim();
        if (!name || !sq) return null;
        return { name, searchQuery: sq };
      })
      .filter((p): p is WordPlaceSuggestion => p !== null);
  }

  return {
    parent: {
      title: String(parsed.parent?.title ?? "Plan importat"),
      type: normalizeType(String(parsed.parent?.type ?? "deep")),
      destination: emptyToUndef(parsed.parent?.destination),
      summary: String(parsed.parent?.summary ?? ""),
      body: String(parsed.parent?.body ?? ""),
      startDate: emptyToUndef(parsed.parent?.startDate),
      endDate: emptyToUndef(parsed.parent?.endDate),
      checklist: Array.isArray(parsed.parent?.checklist)
        ? parsed.parent.checklist.map((s: unknown) => String(s)).filter(Boolean)
        : [],
      places: parsePlaces(parsed.parent?.places),
    },
    children: Array.isArray(parsed.children)
      ? parsed.children.map((c: Record<string, unknown>) => ({
          title: String(c.title ?? "Sub-plan"),
          type: normalizeType(String(c.type ?? "deep")),
          destination: emptyToUndef(c.destination as string | undefined),
          summary: String(c.summary ?? ""),
          body: String(c.body ?? ""),
          startDate: emptyToUndef(c.startDate as string | undefined),
          endDate: emptyToUndef(c.endDate as string | undefined),
          checklist: Array.isArray(c.checklist)
            ? c.checklist.map((s: unknown) => String(s)).filter(Boolean)
            : [],
          places: parsePlaces(c.places),
        }))
      : [],
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

async function uniqueSlug(base: string, taken: Set<string>): Promise<string> {
  const supabase = await createSupabaseServer();
  const { data } = await supabase.from("plans").select("id").like("id", `${base}%`);
  for (const r of data ?? []) taken.add(r.id as string);
  if (!taken.has(base)) {
    taken.add(base);
    return base;
  }
  for (let i = 2; i < 1000; i++) {
    const candidate = `${base}-${i}`;
    if (!taken.has(candidate)) {
      taken.add(candidate);
      return candidate;
    }
  }
  const fallback = `${base}-${Date.now()}`;
  taken.add(fallback);
  return fallback;
}

const DEFAULT_COVER =
  "linear-gradient(135deg, #F4A26E 0%, #E27A45 45%, #6B97A8 100%)";

/**
 * Geocodifica una llista de places via Nominatim, espaiat 1.1s per respectar
 * el límit gratuït. Retorna files llestes per inserir a `places` o null si no s'ha trobat.
 */
async function geocodePlaces(
  planId: string,
  suggestions: WordPlaceSuggestion[],
  startIndex: number = 0,
): Promise<{
  rows: Array<Record<string, unknown>>;
  added: number;
  failed: string[];
}> {
  const rows: Array<Record<string, unknown>> = [];
  const failed: string[] = [];

  for (let i = 0; i < suggestions.length; i++) {
    const sugg = suggestions[i];
    try {
      const results = await geocodeSearch(sugg.searchQuery);
      const first = results[0];
      if (!first) {
        failed.push(sugg.name);
      } else {
        rows.push({
          id: crypto.randomUUID(),
          plan_id: planId,
          name: sugg.name,
          country: first.country,
          lat: first.lat,
          lng: first.lng,
          order_index: startIndex + i,
          notes: null,
        });
      }
    } catch {
      failed.push(sugg.name);
    }
    // Nominatim: respect ≤1 req/s.
    if (i < suggestions.length - 1) {
      await new Promise((r) => setTimeout(r, 1100));
    }
  }

  return { rows, added: rows.length, failed };
}

/**
 * Pas 2: rep l'estructura ja validada per l'usuari i crea pare + fills +
 * checklist + places (geocodificades). Si tot va bé, retorna l'ID del pare
 * per redirigir-hi.
 */
export async function createPlansFromAnalysis(
  analysis: WordAnalysis,
): Promise<{
  parentId: string;
  createdChildren: number;
  placesAdded: number;
  placesFailed: string[];
}> {
  const supabase = await createSupabaseServer();
  const now = new Date().toISOString();
  const takenSlugs = new Set<string>();

  // 1) Crear pare.
  const parentId = await uniqueSlug(slugify(analysis.parent.title), takenSlugs);
  const { error: parentError } = await supabase.from("plans").insert({
    id: parentId,
    title: analysis.parent.title,
    type: analysis.parent.type,
    status: "planning",
    cover: DEFAULT_COVER,
    destination: analysis.parent.destination ?? null,
    start_date: analysis.parent.startDate ?? null,
    end_date: analysis.parent.endDate ?? null,
    summary: analysis.parent.summary,
    body: analysis.parent.body,
    budget_total: null,
    budget_currency: null,
    parent_plan_id: null,
    created_at: now,
    updated_at: now,
  });
  if (parentError) throw new Error(`Crear pare: ${parentError.message}`);

  // 2) Checklist del pare.
  if (analysis.parent.checklist.length > 0) {
    const rows = analysis.parent.checklist.map((text) => ({
      id: crypto.randomUUID(),
      plan_id: parentId,
      text,
      done: false,
    }));
    const { error: checklistError } = await supabase
      .from("checklist_items")
      .insert(rows);
    if (checklistError) {
      throw new Error(`Crear checklist pare: ${checklistError.message}`);
    }
  }

  let placesAdded = 0;
  const placesFailed: string[] = [];

  // 3) Places del pare (geocodificades).
  if (analysis.parent.places.length > 0) {
    const { rows, added, failed } = await geocodePlaces(
      parentId,
      analysis.parent.places,
    );
    placesAdded += added;
    placesFailed.push(...failed);
    if (rows.length > 0) {
      const { error: placesError } = await supabase.from("places").insert(rows);
      if (placesError) {
        throw new Error(`Inserir places pare: ${placesError.message}`);
      }
    }
  }

  // 4) Fills.
  let createdChildren = 0;
  for (const child of analysis.children) {
    const childId = await uniqueSlug(slugify(child.title), takenSlugs);
    const { error: childError } = await supabase.from("plans").insert({
      id: childId,
      title: child.title,
      type: child.type,
      status: "planning",
      cover: DEFAULT_COVER,
      destination: child.destination ?? null,
      start_date: child.startDate ?? null,
      end_date: child.endDate ?? null,
      summary: child.summary,
      body: child.body,
      budget_total: null,
      budget_currency: null,
      parent_plan_id: parentId,
      created_at: now,
      updated_at: now,
    });
    if (childError) {
      throw new Error(`Crear fill ${child.title}: ${childError.message}`);
    }
    createdChildren += 1;

    if (child.checklist.length > 0) {
      const rows = child.checklist.map((text) => ({
        id: crypto.randomUUID(),
        plan_id: childId,
        text,
        done: false,
      }));
      const { error: checklistError } = await supabase
        .from("checklist_items")
        .insert(rows);
      if (checklistError) {
        throw new Error(
          `Crear checklist fill ${child.title}: ${checklistError.message}`,
        );
      }
    }

    if (child.places.length > 0) {
      const { rows, added, failed } = await geocodePlaces(
        childId,
        child.places,
      );
      placesAdded += added;
      placesFailed.push(...failed);
      if (rows.length > 0) {
        const { error: placesError } = await supabase.from("places").insert(rows);
        if (placesError) {
          throw new Error(
            `Inserir places fill ${child.title}: ${placesError.message}`,
          );
        }
      }
    }
  }

  revalidatePath("/");
  revalidatePath(`/plans/${parentId}`);

  return { parentId, createdChildren, placesAdded, placesFailed };
}
