"use server";

import { GoogleGenAI, Type } from "@google/genai";
import { revalidatePath } from "next/cache";
import { createSupabaseServer } from "./supabase-server";
import { geocodeSearch } from "./place-actions";

const apiKey = process.env.GOOGLE_AI_API_KEY;

function getClient(): GoogleGenAI {
  if (!apiKey) {
    throw new Error(
      "Falta GOOGLE_AI_API_KEY a .env.local. Crea una key a aistudio.google.com.",
    );
  }
  return new GoogleGenAI({ apiKey });
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

// Esquema JSON estructurat que el model haurà de complir.
const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    enriched_body: {
      type: Type.STRING,
      description:
        "Cos del plan millorat en Markdown català. Manté el to càlid i la veu de l'usuari. Estructura amb seccions H2 (## ).",
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

export async function polishWithAi(planId: string): Promise<PolishSuggestions> {
  const supabase = await createSupabaseServer();

  const { data: plan, error: planError } = await supabase
    .from("plans")
    .select("id,title,type,destination,summary,body")
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

  const typeLabel = { deep: "viatge llarg", weekend: "cap de setmana", day: "dia" }[
    plan.type as "deep" | "weekend" | "day"
  ];

  const systemInstruction = `Ets un assistent que ajuda a enriquir plans de viatges i escapades per a una agenda íntima en català.

Regles:
- Manté el to càlid i personal — escriu com si fossis l'usuari mateix prenent notes. Primera persona del plural ("anem", "fem", "tenim"), gens corporatiu.
- NO inventis detalls específics que no podrien ser certs (preus exactes, horaris molt precisos). Pots dir "sobre les 8 del vespre" o "uns 15€/persona" però evita dades irreals.
- Per als places, dona search queries que OpenStreetMap (Nominatim) pugui resoldre — inclou ciutat o regió.
- Respon SEMPRE seguint l'esquema JSON proporcionat. No afegeixis text fora del JSON.`;

  const userMessage = `Plan a millorar:

Tipus: ${typeLabel ?? plan.type}
Títol: ${plan.title}
Destinació: ${plan.destination ?? "(sense definir)"}
Resum: ${plan.summary}

Cos actual:
\`\`\`markdown
${plan.body}
\`\`\`

Llocs ja afegits al mapa (NO suggerir aquests):
${placesList}

Items de checklist ja existents (NO suggerir aquests):
${checklistList}

Tasques:
1. Enriqueix el cos amb estructura Markdown (## per seccions), afegeix detalls realistes i petits consells. Manté la veu de l'usuari.
2. Suggereix 3-8 llocs concrets per visitar/fer relacionats amb el plan. Cada lloc ha de tenir un search_query precís.
3. Suggereix 3-6 items de checklist que l'usuari potser ha oblidat (reserves, equipatge, vacunes, entrades, etc).`;

  const client = getClient();
  const response = await client.models.generateContent({
    model: "gemini-2.0-flash",
    contents: [{ role: "user", parts: [{ text: userMessage }] }],
    config: {
      systemInstruction,
      responseMimeType: "application/json",
      responseSchema: RESPONSE_SCHEMA,
      temperature: 0.6,
    },
  });

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

export async function applyPolishedBody(planId: string, body: string): Promise<void> {
  const supabase = await createSupabaseServer();
  const { error } = await supabase
    .from("plans")
    .update({ body, updated_at: new Date().toISOString() })
    .eq("id", planId);
  if (error) throw new Error(`Aplicar cos: ${error.message}`);
  revalidatePath(`/plans/${planId}`);
  revalidatePath(`/plans/${planId}/edit`);
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
