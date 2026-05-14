"use server";

import { GoogleGenAI } from "@google/genai";
import { revalidatePath } from "next/cache";
import { createSupabaseServer } from "./supabase-server";
import { formatDateRange } from "./format";

const apiKey = process.env.GOOGLE_AI_API_KEY;

function getClient(): GoogleGenAI {
  if (!apiKey) {
    throw new Error("Falta GOOGLE_AI_API_KEY a .env.local.");
  }
  return new GoogleGenAI({ apiKey });
}

// Tradueix els errors de l'API a missatges curts (duplicat tolerable de
// `ai-actions.ts` — TODO mover a un helper compartit a la pròxima refactor).
function translateGeminiError(e: unknown): Error {
  const raw = e instanceof Error ? e.message : String(e);

  if (/RESOURCE_EXHAUSTED|429|quota|rate.?limit/i.test(raw)) {
    return new Error("Has superat la quota de Gemini per ara. Prova-ho d'aquí uns segons.");
  }
  if (/API key not valid|INVALID_ARGUMENT.*api[_ ]?key|permission/i.test(raw)) {
    return new Error("La clau de Gemini no és vàlida. Revisa GOOGLE_AI_API_KEY.");
  }
  if (/network|fetch failed|ECONNREFUSED|ETIMEDOUT/i.test(raw)) {
    return new Error("No s'ha pogut contactar amb Gemini. Comprova la connexió.");
  }
  return new Error(`Error de la IA: ${raw.slice(0, 200)}`);
}

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
};

/** Tots els missatges d'un plan ordenats cronològicament. */
export async function getChatMessages(planId: string): Promise<ChatMessage[]> {
  const supabase = await createSupabaseServer();
  const { data, error } = await supabase
    .from("plan_messages")
    .select("id,role,content,created_at")
    .eq("plan_id", planId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(`Llegir missatges: ${error.message}`);
  return (data ?? []).map((r) => ({
    id: r.id as string,
    role: r.role as "user" | "assistant",
    content: r.content as string,
    createdAt: r.created_at as string,
  }));
}

/**
 * Envia un missatge al copilot. Carrega tot el context del plan (metadades +
 * places + checklist + body) per a la system instruction, agafa els darrers 20
 * missatges com a historial i crida Gemini. Desa els dos missatges (user +
 * assistant) a la BBDD i retorna l'assistant.
 *
 * NO té function calling encara — el copilot només respon, no modifica el plan.
 * Això vindrà a M8.2.
 */
export async function sendChatMessage(
  planId: string,
  userContent: string,
): Promise<ChatMessage> {
  const trimmed = userContent.trim();
  if (!trimmed) throw new Error("El missatge no pot estar buit.");
  if (trimmed.length > 4000) {
    throw new Error("Missatge massa llarg (màx 4000 caràcters).");
  }

  const supabase = await createSupabaseServer();

  const { data: plan, error: planError } = await supabase
    .from("plans")
    .select("id,title,type,destination,start_date,end_date,summary,body")
    .eq("id", planId)
    .single();
  if (planError || !plan) throw new Error("Plan no trobat");

  // Carrega context relacionat + historial en paral·lel.
  const [placesRes, checklistRes, messagesRes] = await Promise.all([
    supabase.from("places").select("name,country").eq("plan_id", planId).order("order_index"),
    supabase.from("checklist_items").select("text,done").eq("plan_id", planId),
    supabase
      .from("plan_messages")
      .select("role,content")
      .eq("plan_id", planId)
      .order("created_at", { ascending: true }),
  ]);

  const placesList =
    placesRes.data && placesRes.data.length > 0
      ? placesRes.data
          .map((p) => `- ${p.name}${p.country ? ` (${p.country})` : ""}`)
          .join("\n")
      : "(cap)";

  const checklistList =
    checklistRes.data && checklistRes.data.length > 0
      ? checklistRes.data.map((c) => `- [${c.done ? "x" : " "}] ${c.text}`).join("\n")
      : "(cap)";

  const dateRange = formatDateRange(
    plan.start_date ?? undefined,
    plan.end_date ?? undefined,
  );

  const typeLabel = { deep: "viatge llarg", weekend: "cap de setmana", day: "dia" }[
    plan.type as "deep" | "weekend" | "day"
  ];

  const systemInstruction = `Ets el copilot del pla "${plan.title}". Aquí tens tota la informació actual:

Tipus: ${typeLabel ?? plan.type}
Destinació: ${plan.destination ?? "(sense definir)"}
Dates: ${dateRange ?? "(sense definir)"}
Resum: ${plan.summary}

Llocs al mapa:
${placesList}

Checklist:
${checklistList}

Cos del pla (Markdown, pot incloure imatges \`![](pp:...)\`):
\`\`\`
${plan.body}
\`\`\`

Regles de resposta:
- Respon SEMPRE en català, to càlid i personal, com un amic que ajuda a planificar (no corporatiu).
- Sigues breu (1-4 paràgrafs) i útil. Pots usar llistes si convé.
- Pots respondre preguntes sobre el pla, recomanar coses concretes (restaurants, hotels, llocs), comparar opcions, ajudar a decidir.
- NO inventis dades concretes (preus exactes, horaris) — aproxima: "uns 15€/persona", "sobre les 8 del vespre".
- Si l'usuari et demana modificar el plan (afegir lloc, canviar body, etc.), respon-li que de moment només pots ajudar amb idees i preguntes; per editar ha d'anar al detall del plan (botó "Editar") o usar el Polish amb IA.`;

  // Limita el context als darrers 20 missatges per estalviar tokens.
  const recentMessages = (messagesRes.data ?? []).slice(-20);
  const history = recentMessages.map((m) => ({
    role: m.role === "user" ? "user" : "model",
    parts: [{ text: m.content as string }],
  }));
  history.push({
    role: "user",
    parts: [{ text: trimmed }],
  });

  const client = getClient();
  let response;
  try {
    response = await client.models.generateContent({
      model: "gemini-2.5-flash",
      contents: history,
      config: {
        systemInstruction,
        temperature: 0.7,
      },
    });
  } catch (e) {
    throw translateGeminiError(e);
  }

  const reply = response.text;
  if (!reply || !reply.trim()) {
    throw new Error("La IA no ha tornat resposta. Torna-ho a provar.");
  }

  const userId = crypto.randomUUID();
  const assistantId = crypto.randomUUID();
  const { error: insertError } = await supabase.from("plan_messages").insert([
    { id: userId, plan_id: planId, role: "user", content: trimmed },
    { id: assistantId, plan_id: planId, role: "assistant", content: reply },
  ]);
  if (insertError) throw new Error(`Desar missatges: ${insertError.message}`);

  // No revalidem `/plans/${planId}` perquè el xat és client-side optimistic;
  // el component ja té els missatges nous a state.

  return {
    id: assistantId,
    role: "assistant",
    content: reply,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Esborra tota la conversa d'un plan (per a "Començar de nou" al UI).
 */
export async function clearChatMessages(planId: string): Promise<void> {
  const supabase = await createSupabaseServer();
  const { error } = await supabase.from("plan_messages").delete().eq("plan_id", planId);
  if (error) throw new Error(`Esborrar conversa: ${error.message}`);
  revalidatePath(`/plans/${planId}`);
}
