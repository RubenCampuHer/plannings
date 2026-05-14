"use server";

import { GoogleGenAI, Type } from "@google/genai";
import { revalidatePath } from "next/cache";
import { createSupabaseServer } from "./supabase-server";
import { geocodeSearch } from "./place-actions";
import { downloadPexelsImage, searchPexelsTop } from "./pexels-actions";
import type { PlanType } from "./types";

const apiKey = process.env.GOOGLE_AI_API_KEY;

function getClient(): GoogleGenAI {
  if (!apiKey) {
    throw new Error(
      "Falta GOOGLE_AI_API_KEY a .env.local. Crea una key a aistudio.google.com.",
    );
  }
  return new GoogleGenAI({ apiKey });
}

// Tradueix els errors de l'API de Google a missatges curts en català perquè
// la UI no mostri el JSON brut.
function translateGeminiError(e: unknown): Error {
  const raw = e instanceof Error ? e.message : String(e);

  if (/RESOURCE_EXHAUSTED|429|quota|rate.?limit/i.test(raw)) {
    // Cas concret: la clau no té quota assignada (limit: 0) — habitualment
    // significa que el projecte de Google Cloud no té l'API habilitada o no
    // té facturació activa.
    if (/limit:\s*0/i.test(raw)) {
      return new Error(
        "La clau de Gemini no té quota (limit: 0). Comprova a aistudio.google.com/apikey que la clau ve d'un projecte amb l'API Generative Language habilitada, o regenera-la des d'un projecte nou.",
      );
    }
    return new Error(
      "Has superat la quota de Gemini per ara. Prova-ho d'aquí uns segons.",
    );
  }

  if (/API key not valid|INVALID_ARGUMENT.*api[_ ]?key|permission/i.test(raw)) {
    return new Error(
      "La clau de Gemini no és vàlida. Revisa GOOGLE_AI_API_KEY a .env.local.",
    );
  }

  if (/network|fetch failed|ECONNREFUSED|ETIMEDOUT/i.test(raw)) {
    return new Error("No s'ha pogut contactar amb Gemini. Comprova la connexió.");
  }

  return new Error(`Error de la IA: ${raw.slice(0, 200)}`);
}

export type SuggestedPlace = {
  name: string;
  searchQuery: string;
  why?: string;
};

export type SuggestedChecklistItem = {
  text: string;
};

export type PolishSuggestions = {
  enrichedBody: string;
  suggestedPlaces: SuggestedPlace[];
  suggestedChecklist: SuggestedChecklistItem[];
};

export type PlanDraft = {
  title: string;
  type: PlanType;
  destination?: string;
  startDate?: string;
  endDate?: string;
  summary: string;
  body: string;
};

// Esquema JSON estructurat que el model haurà de complir.
const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    enriched_body: {
      type: Type.STRING,
      description: `Cos del plan en Markdown català, formatat per llegir-se com a diari personal:
- Seccions amb ## i ### per sub-seccions quan calgui.
- **Negretes** a noms propis importants (ciutats, monuments, restaurants concrets) i conceptes clau.
- *Cursives* per a matisos, frases citades, èmfasi suau.
- Llistes amb - (bullets) o 1. (numerades).
- > blockquotes per a frases memorables, cites o consells importants.
- NO usis taules. NO posis tot en negreta — ha de respirar.
- To càlid en primera persona del plural ("anem", "fem"), com si l'usuari prengués notes per a si mateix.
- Manté qualsevol referència d'imatge tipus ![](pp:...) EXACTAMENT igual; no les rescriguis ni les eliminis.`,
    },
    suggested_places: {
      type: Type.ARRAY,
      description:
        "Llocs interessants per visitar relacionats amb el plan. NO inclou els llocs ja afegits.",
      items: {
        type: Type.OBJECT,
        properties: {
          name: {
            type: Type.STRING,
            description: "Nom curt del lloc.",
          },
          search_query: {
            type: Type.STRING,
            description:
              "Query precisa per buscar a OpenStreetMap. Inclou ciutat o regió. Ex: 'Cinema Verdi Barcelona'.",
          },
          why: {
            type: Type.STRING,
            description: "Per què val la pena (1 frase curta).",
          },
        },
        required: ["name", "search_query"],
      },
    },
    suggested_checklist: {
      type: Type.ARRAY,
      description:
        "Items pràctics que l'usuari potser ha oblidat. NO inclou els items ja existents.",
      items: {
        type: Type.OBJECT,
        properties: {
          text: {
            type: Type.STRING,
            description: "Item curt en català.",
          },
        },
        required: ["text"],
      },
    },
  },
  required: ["enriched_body", "suggested_places", "suggested_checklist"],
};

const SYSTEM_INSTRUCTION = `Ets un assistent que ajuda a enriquir plans de viatges i escapades per a una agenda íntima en català.

Regles:
- Manté el to càlid i personal — escriu com si fossis l'usuari mateix prenent notes. Primera persona del plural ("anem", "fem", "tenim"), gens corporatiu.
- NO inventis detalls específics que no podrien ser certs (preus exactes, horaris molt precisos). Pots dir "sobre les 8 del vespre" o "uns 15€/persona" però evita dades irreals.
- Per als places, dona search queries que OpenStreetMap (Nominatim) pugui resoldre — inclou ciutat o regió.
- Respon SEMPRE seguint l'esquema JSON proporcionat. No afegeixis text fora del JSON.`;

/**
 * Durada del viatge en dies (inclusiu: si start=end llavors 1).
 * Retorna null si no hi ha prou info o si end < start.
 */
function calcDurationDays(start?: string, end?: string): number | null {
  if (!start) return null;
  const effectiveEnd = end || start;
  const startMs = new Date(start).getTime();
  const endMs = new Date(effectiveEnd).getTime();
  if (Number.isNaN(startMs) || Number.isNaN(endMs)) return null;
  if (endMs < startMs) return null;
  return Math.round((endMs - startMs) / 86400000) + 1;
}

/**
 * Heurística: més dies → més places/checklist proposats.
 * Mantenim ranges petits perquè l'usuari no quedi soterrat de suggeriments.
 */
function targetRanges(
  durationDays: number | null,
  type: PlanType,
): { places: [number, number]; checklist: [number, number] } {
  // Per a plans `day` o sense dates: range curt.
  if (type === "day" || durationDays == null || durationDays <= 1) {
    return { places: [3, 6], checklist: [2, 4] };
  }
  if (durationDays <= 4) return { places: [6, 10], checklist: [4, 6] };
  if (durationDays <= 10) return { places: [10, 15], checklist: [5, 8] };
  if (durationDays <= 20) return { places: [15, 22], checklist: [6, 10] };
  return { places: [22, 30], checklist: [8, 12] };
}

function durationLabel(days: number | null): string {
  if (days == null) return "(sense dates definides)";
  if (days === 1) return "1 dia";
  if (days < 7) return `${days} dies`;
  if (days < 14) {
    const weeks = Math.round(days / 7);
    return `${days} dies (~${weeks} ${weeks === 1 ? "setmana" : "setmanes"})`;
  }
  if (days < 60) {
    const weeks = Math.round(days / 7);
    return `${days} dies (~${weeks} setmanes)`;
  }
  const months = Math.round(days / 30);
  return `${days} dies (~${months} mesos)`;
}

function buildUserMessage(
  draft: PlanDraft,
  existingPlaces: string,
  existingChecklist: string,
): string {
  const typeLabel = { deep: "viatge llarg", weekend: "cap de setmana", day: "dia" }[
    draft.type
  ];
  const durationDays = calcDurationDays(draft.startDate, draft.endDate);
  const ranges = targetRanges(durationDays, draft.type);
  const durLabel = durationLabel(durationDays);

  // La instrucció de durada s'inclou tant si hi ha dates com si no.
  // Si no n'hi ha, l'AI fa servir el rang curt per defecte.
  const durationLine =
    durationDays != null
      ? `Durada: ${durLabel} → això vol dir un viatge ${
          durationDays <= 1
            ? "d'un dia"
            : durationDays <= 4
            ? "curt"
            : durationDays <= 10
            ? "d'una setmana o així"
            : durationDays <= 20
            ? "de dues-tres setmanes"
            : "llarg, de més d'un mes"
        }.`
      : `Durada: sense dates → treballa amb un viatge d'abast curt.`;

  return `Plan a millorar:

Tipus: ${typeLabel}
Títol: ${draft.title}
Destinació: ${draft.destination ?? "(sense definir)"}
${durationLine}
Resum: ${draft.summary}

Cos actual:
\`\`\`markdown
${draft.body}
\`\`\`

Llocs ja afegits al mapa (NO suggerir aquests):
${existingPlaces}

Items de checklist ja existents (NO suggerir aquests):
${existingChecklist}

Tasques:
1. Enriqueix el cos amb format ric (## i ###, **negretes** a noms propis, *cursives* a matisos, > blockquotes ocasionals, llistes amb -). Afegeix detalls realistes i petits consells. ${
    durationDays != null && durationDays > 4
      ? "Aprofita la durada per estructurar el cos en seccions (per dies, per regions, per fases del viatge) — donа-li profunditat."
      : durationDays != null && durationDays <= 1
      ? "Manté el cos compacte i centrat — és un sol dia."
      : "Manté el cos focalitzat i pràctic."
  } Manté la veu de l'usuari. Preserva qualsevol \`![](pp:...)\` exactament igual.
2. Suggereix entre ${ranges.places[0]} i ${ranges.places[1]} llocs concrets per visitar/fer relacionats amb el plan, proporcional a la durada. Cada lloc ha de tenir un search_query precís (inclou ciutat i país).
3. Suggereix entre ${ranges.checklist[0]} i ${ranges.checklist[1]} items de checklist que l'usuari potser ha oblidat (reserves, equipatge, vacunes, entrades, etc).`;
}

async function callGemini(userMessage: string): Promise<PolishSuggestions> {
  const client = getClient();
  let response;
  try {
    response = await client.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: userMessage }] }],
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: RESPONSE_SCHEMA,
        temperature: 0.6,
      },
    });
  } catch (e) {
    throw translateGeminiError(e);
  }

  const text = response.text;
  if (!text) {
    throw new Error("La IA no ha tornat cap resposta. Torna-ho a provar.");
  }

  let parsed: {
    enriched_body: string;
    suggested_places: Array<{ name: string; search_query: string; why?: string }>;
    suggested_checklist: Array<{ text: string }>;
  };
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Resposta de la IA no és JSON vàlid. Torna-ho a provar.");
  }

  return {
    enrichedBody: parsed.enriched_body,
    suggestedPlaces: (parsed.suggested_places ?? []).map((p) => ({
      name: p.name,
      searchQuery: p.search_query,
      why: p.why,
    })),
    suggestedChecklist: (parsed.suggested_checklist ?? []).map((c) => ({ text: c.text })),
  };
}

export async function polishWithAi(planId: string): Promise<PolishSuggestions> {
  const supabase = await createSupabaseServer();

  const { data: plan, error: planError } = await supabase
    .from("plans")
    .select("id,title,type,destination,start_date,end_date,summary,body")
    .eq("id", planId)
    .single();
  if (planError || !plan) throw new Error("Plan no trobat");

  const [{ data: places }, { data: checklist }] = await Promise.all([
    supabase.from("places").select("name,country").eq("plan_id", planId),
    supabase.from("checklist_items").select("text").eq("plan_id", planId),
  ]);

  const placesList =
    places && places.length > 0
      ? places.map((p) => `- ${p.name}${p.country ? ` (${p.country})` : ""}`).join("\n")
      : "(cap)";
  const checklistList =
    checklist && checklist.length > 0
      ? checklist.map((c) => `- ${c.text}`).join("\n")
      : "(cap)";

  const draft: PlanDraft = {
    title: plan.title,
    type: plan.type as PlanType,
    destination: plan.destination ?? undefined,
    startDate: plan.start_date ?? undefined,
    endDate: plan.end_date ?? undefined,
    summary: plan.summary,
    body: plan.body,
  };

  const userMessage = buildUserMessage(draft, placesList, checklistList);
  return callGemini(userMessage);
}

/**
 * Variant per al mode `new`: encara no hi ha plan a la BBDD, llegim els camps
 * del form en construcció. Mateix prompt que `polishWithAi`, sense places/
 * checklist preexistents.
 */
export async function polishWithAiFromDraft(
  draft: PlanDraft,
): Promise<PolishSuggestions> {
  if (!draft.title.trim()) throw new Error("Necessites un títol per a polish.");
  if (!draft.summary.trim()) throw new Error("Necessites un resum per a polish.");
  if (!draft.body.trim()) throw new Error("Necessites una mica de cos per a polish.");

  const userMessage = buildUserMessage(draft, "(cap)", "(cap)");
  return callGemini(userMessage);
}

export async function addAiChecklistItems(
  planId: string,
  texts: string[],
): Promise<void> {
  if (texts.length === 0) return;
  const supabase = await createSupabaseServer();
  const rows = texts.map((text) => ({
    id: crypto.randomUUID(),
    plan_id: planId,
    text,
    done: false,
  }));
  const { error } = await supabase.from("checklist_items").insert(rows);
  if (error) throw new Error(`Afegir checklist: ${error.message}`);
  revalidatePath(`/plans/${planId}`);
  revalidatePath(`/plans/${planId}/edit`);
}

// =====================================================================
// M7 — Polish imatges amb IA (Gemini + Pexels)
// =====================================================================

const IMAGE_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    images: {
      type: Type.ARRAY,
      description:
        "Suggeriments d'imatges per il·lustrar el plan. Cobreix moments/llocs clau, no repeteixis temàtiques.",
      items: {
        type: Type.OBJECT,
        properties: {
          search_query: {
            type: Type.STRING,
            description:
              "Query en anglès per buscar a Pexels. Concreta i visual (ex. 'Bangkok night market food', 'Hokkaido snow onsen', 'Tuscany vineyard sunset'). Inclou lloc + element visual.",
          },
          alt_text: {
            type: Type.STRING,
            description:
              "Descripció curta en català per al figcaption + l'àlbum. Estil diari personal, 4-9 paraules. Ex: 'Llums de nit a Bangkok' o 'Onsen sota la neu, Hokkaido'.",
          },
          placement: {
            type: Type.STRING,
            description:
              "On va al body: 'intro' (al principi), 'outro' (al final), o el text exacte d'una de les headings ## existents. Si no n'hi ha, usa 'outro'.",
          },
        },
        required: ["search_query", "alt_text", "placement"],
      },
    },
  },
  required: ["images"],
};

const IMAGE_SYSTEM_INSTRUCTION = `Ets un editor d'imatges per a una agenda íntima de viatges en català.

Regles:
- Les search queries van en anglès perquè Pexels té molt més material indexat així.
- L'alt_text va en català, curt i evocador (estil diari personal). NO repeteixis "foto de" o "imatge de".
- NO suggereixis més imatges de les demanades — millor poques i ben repartides que moltes redundants.
- Reparteix les imatges entre seccions diferents. Si una secció ja tindria 2 imatges, posa la següent en una altra heading.
- Respon SEMPRE seguint l'esquema JSON. No afegeixis text fora del JSON.`;

function targetImageCount(
  durationDays: number | null,
  type: PlanType,
): { min: number; max: number } {
  if (type === "day" || durationDays == null || durationDays <= 1) {
    return { min: 2, max: 3 };
  }
  if (durationDays <= 4) return { min: 3, max: 5 };
  if (durationDays <= 10) return { min: 4, max: 6 };
  if (durationDays <= 20) return { min: 5, max: 7 };
  return { min: 6, max: 8 };
}

/** Extreu títols de headings ## per donar context a la IA. */
function extractH2Titles(body: string): string[] {
  const titles: string[] = [];
  const re = /^## (.+)$/gm;
  let m;
  while ((m = re.exec(body)) !== null) {
    titles.push(m[1].trim());
  }
  return titles;
}

/**
 * Insereix `![alt](pp:path)` al body segons el `placement` de cada imatge.
 * 'intro' → abans del primer H2. 'outro' o cap match → al final.
 * Match d'una heading existent → al final d'aquella secció (just abans del
 * següent H2).
 */
function insertInlineImages(
  body: string,
  images: Array<{ path: string; alt: string; placement: string }>,
): string {
  const headings: Array<{ title: string; start: number }> = [];
  const h2Re = /^## (.+)$/gm;
  let m;
  while ((m = h2Re.exec(body)) !== null) {
    headings.push({ title: m[1].trim(), start: m.index });
  }

  type Insertion = { pos: number; text: string };
  const insertions: Insertion[] = [];

  for (const img of images) {
    const target = img.placement.toLowerCase().trim();
    const imgMd = `\n\n![${img.alt}](pp:${img.path})\n\n`;
    let pos: number;

    if (target === "intro" || target === "") {
      // Just abans del primer H2; si no n'hi ha, al principi.
      pos = headings[0]?.start ?? 0;
    } else if (target === "outro" || target === "final" || headings.length === 0) {
      pos = body.length;
    } else {
      const idx = headings.findIndex(
        (h) =>
          h.title.toLowerCase().includes(target) ||
          target.includes(h.title.toLowerCase()),
      );
      if (idx === -1) {
        pos = body.length;
      } else {
        pos = idx + 1 < headings.length ? headings[idx + 1].start : body.length;
      }
    }
    insertions.push({ pos, text: imgMd });
  }

  // Inserim de més tardà a més primer perquè els offsets no es desplacin.
  insertions.sort((a, b) => b.pos - a.pos);
  let result = body;
  for (const ins of insertions) {
    result = result.slice(0, ins.pos) + ins.text + result.slice(ins.pos);
  }
  // Normalitza els salts de línia repetits a màxim 2 consecutius.
  return result.replace(/\n{3,}/g, "\n\n").trim() + "\n";
}

function extFromContentType(mime: string): string {
  if (/png/i.test(mime)) return "png";
  if (/webp/i.test(mime)) return "webp";
  return "jpg";
}

export type ImagePolishResult = {
  added: number;
  failed: string[];
  bodyUpdated: boolean;
};

/**
 * Una sola crida que: pregunta a Gemini quines imatges encaixen, busca cadascuna
 * a Pexels, descarrega + puja al bucket, insereix-les inline al body i les
 * afegeix a la taula `plan_photos`. La quantitat depèn de la durada del viatge.
 */
export async function polishImagesWithAi(
  planId: string,
): Promise<ImagePolishResult> {
  const supabase = await createSupabaseServer();

  const { data: plan, error: planError } = await supabase
    .from("plans")
    .select("id,title,type,destination,start_date,end_date,summary,body")
    .eq("id", planId)
    .single();
  if (planError || !plan) throw new Error("Plan no trobat");

  const planType = plan.type as PlanType;
  const durationDays = calcDurationDays(plan.start_date ?? undefined, plan.end_date ?? undefined);
  const counts = targetImageCount(durationDays, planType);
  const headings = extractH2Titles(plan.body);
  const typeLabel = { deep: "viatge llarg", weekend: "cap de setmana", day: "dia" }[planType];

  const headingsList =
    headings.length > 0
      ? headings.map((h) => `- "${h}"`).join("\n")
      : "(cap heading ## al body — usa 'outro' per a totes les imatges)";

  const userMessage = `Plan:

Tipus: ${typeLabel}
Títol: ${plan.title}
Destinació: ${plan.destination ?? "(sense definir)"}
Durada: ${durationLabel(durationDays)}
Resum: ${plan.summary}

Cos:
\`\`\`markdown
${plan.body}
\`\`\`

Headings ## existents al body (usables com a placement):
${headingsList}

Tasca: suggereix entre ${counts.min} i ${counts.max} imatges per il·lustrar el plan. Reparteix-les entre seccions diferents. Search queries en anglès, alt_text en català, placement = 'intro' | 'outro' | text exacte d'una heading.`;

  const client = getClient();
  let response;
  try {
    response = await client.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: userMessage }] }],
      config: {
        systemInstruction: IMAGE_SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: IMAGE_RESPONSE_SCHEMA,
        temperature: 0.7,
      },
    });
  } catch (e) {
    throw translateGeminiError(e);
  }

  const text = response.text;
  if (!text) throw new Error("La IA no ha tornat cap suggeriment.");

  let parsed: {
    images: Array<{ search_query: string; alt_text: string; placement: string }>;
  };
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Resposta de la IA no és JSON vàlid.");
  }

  const suggestions = (parsed.images ?? []).slice(0, counts.max);
  if (suggestions.length === 0) {
    throw new Error("La IA no ha suggerit cap imatge. Prova-ho de nou.");
  }

  // Per a cada suggeriment: cerca a Pexels, descarrega, puja al bucket.
  // Es fan en paral·lel — Pexels admet ràfegues curtes per a la free tier.
  type Applied = { path: string; alt: string; placement: string; mime: string };
  const failed: string[] = [];
  const settled = await Promise.allSettled(
    suggestions.map(async (s): Promise<Applied | null> => {
      const photo = await searchPexelsTop(s.search_query);
      if (!photo) return null;
      const { buffer, contentType } = await downloadPexelsImage(photo.largeUrl);
      const ext = extFromContentType(contentType);
      const uuid = crypto.randomUUID();
      const path = `${planId}/polish-${uuid}.${ext}`;

      const { error: upErr } = await supabase.storage
        .from("plan-photos")
        .upload(path, buffer, { contentType, upsert: false });
      if (upErr) throw new Error(`Pujar imatge: ${upErr.message}`);

      return { path, alt: s.alt_text, placement: s.placement, mime: contentType };
    }),
  );

  const applied: Applied[] = [];
  for (let i = 0; i < settled.length; i++) {
    const r = settled[i];
    if (r.status === "fulfilled" && r.value) {
      applied.push(r.value);
    } else {
      failed.push(suggestions[i].search_query);
    }
  }

  if (applied.length === 0) {
    return { added: 0, failed, bodyUpdated: false };
  }

  // Inserim al body i actualitzem la row del plan.
  const newBody = insertInlineImages(plan.body, applied);
  const { error: bodyErr } = await supabase
    .from("plans")
    .update({ body: newBody, updated_at: new Date().toISOString() })
    .eq("id", planId);
  if (bodyErr) {
    // Si el body falla, intentem ser conservadors: les imatges ja són al bucket
    // i les volem mostrar igualment a l'àlbum (sota); no rollback de la pujada.
    throw new Error(`Actualitzar body: ${bodyErr.message}`);
  }

  // Files a plan_photos perquè les imatges també surtin a l'Àlbum.
  const photoRows = applied.map((a) => ({
    id: crypto.randomUUID(),
    plan_id: planId,
    storage_path: a.path,
    mime_type: a.mime,
    caption: a.alt,
  }));
  const { error: photosErr } = await supabase.from("plan_photos").insert(photoRows);
  if (photosErr) {
    // No és crític si falla — les imatges segueixen visibles inline al body.
    // El log queda al server, l'usuari veu el body actualitzat.
    console.error(`plan_photos insert: ${photosErr.message}`);
  }

  revalidatePath(`/plans/${planId}`);
  revalidatePath(`/plans/${planId}/edit`);

  return {
    added: applied.length,
    failed,
    bodyUpdated: true,
  };
}

export async function applyAiPlaceSuggestions(
  planId: string,
  suggestions: SuggestedPlace[],
): Promise<{ added: number; failed: string[] }> {
  if (suggestions.length === 0) return { added: 0, failed: [] };

  const supabase = await createSupabaseServer();

  const { data: existing } = await supabase
    .from("places")
    .select("order_index")
    .eq("plan_id", planId)
    .order("order_index", { ascending: false })
    .limit(1);
  let nextIndex = (existing?.[0]?.order_index ?? -1) + 1;

  const failed: string[] = [];
  const rows: Array<Record<string, unknown>> = [];

  for (const sugg of suggestions) {
    try {
      const results = await geocodeSearch(sugg.searchQuery);
      const first = results[0];
      if (!first) {
        failed.push(sugg.name);
        continue;
      }
      rows.push({
        id: crypto.randomUUID(),
        plan_id: planId,
        name: sugg.name,
        country: first.country,
        lat: first.lat,
        lng: first.lng,
        order_index: nextIndex++,
        notes: sugg.why ?? null,
      });
      // Nominatim: ≤1 req/s.
      await new Promise((r) => setTimeout(r, 1100));
    } catch {
      failed.push(sugg.name);
    }
  }

  if (rows.length > 0) {
    const { error } = await supabase.from("places").insert(rows);
    if (error) throw new Error(`Afegir llocs: ${error.message}`);
  }

  revalidatePath(`/plans/${planId}`);
  revalidatePath(`/plans/${planId}/edit`);
  return { added: rows.length, failed };
}
