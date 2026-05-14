"use server";

import { GoogleGenAI } from "@google/genai";
import { revalidatePath } from "next/cache";
import { createSupabaseServer } from "./supabase-server";
import { formatDateRange } from "./format";
import { extractHeadings } from "./toc";

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
    .select("id,title,type,destination,start_date,end_date,summary,body,parent_plan_id")
    .eq("id", planId)
    .single();
  if (planError || !plan) throw new Error("Plan no trobat");

  // Carrega tot el context relacionat + historial en paral·lel:
  // pare (si en té), fills (sub-plans), llocs, checklist, missatges previs.
  const [parentRes, childrenRes, placesRes, checklistRes, messagesRes] = await Promise.all([
    plan.parent_plan_id
      ? supabase
          .from("plans")
          .select("id,title,type,destination,start_date,end_date,summary")
          .eq("id", plan.parent_plan_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("plans")
      .select("id,title,type,destination,start_date,end_date,summary")
      .eq("parent_plan_id", planId)
      .order("start_date", { ascending: true, nullsFirst: false }),
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

  const typeLabelOf = (t: string) =>
    ({ deep: "viatge llarg", weekend: "cap de setmana", day: "dia" })[
      t as "deep" | "weekend" | "day"
    ] ?? t;

  // Bloc d'informació del pla pare (si en té).
  const parentBlock = parentRes.data
    ? `\nAquest pla forma part d'un viatge més gran:
- "${parentRes.data.title}" (${typeLabelOf(parentRes.data.type)}${
        parentRes.data.destination ? `, ${parentRes.data.destination}` : ""
      }${
        formatDateRange(
          parentRes.data.start_date ?? undefined,
          parentRes.data.end_date ?? undefined,
        )
          ? `, ${formatDateRange(
              parentRes.data.start_date ?? undefined,
              parentRes.data.end_date ?? undefined,
            )}`
          : ""
      }). Resum: ${parentRes.data.summary}. Enllaç: /plans/${parentRes.data.id}`
    : "";

  // Bloc dels sub-plans (fills) si n'hi ha.
  const children = childrenRes.data ?? [];
  const childrenBlock =
    children.length > 0
      ? `\nSub-plans (peces d'aquest viatge):\n${children
          .map((c) => {
            const dr = formatDateRange(
              c.start_date ?? undefined,
              c.end_date ?? undefined,
            );
            return `- "${c.title}" (${typeLabelOf(c.type)}${
              c.destination ? `, ${c.destination}` : ""
            }${dr ? `, ${dr}` : ""}): ${c.summary}. Enllaç: /plans/${c.id}`;
          })
          .join("\n")}`
      : "";

  // Llista de seccions H2 i H3 del body — permet al copilot remetre l'usuari
  // a una sub-secció concreta amb un enllaç clicable. Indenta les H3 perquè
  // es vegi la jerarquia.
  const headings = extractHeadings(plan.body, [2, 3]);
  const headingsBlock =
    headings.length > 0
      ? `\nSeccions del cos del plan (slugs que pots usar als enllaços — prefereix H3 si és més específic):\n${headings
          .map((h) =>
            h.level === 3
              ? `  - H3 "${h.text}" → #${h.id}`
              : `- H2 "${h.text}" → #${h.id}`,
          )
          .join("\n")}`
      : "";

  const systemInstruction = `Ets el copilot del pla "${plan.title}". Aquí tens tota la informació actual:

Tipus: ${typeLabelOf(plan.type)}
Destinació: ${plan.destination ?? "(sense definir)"}
Dates: ${dateRange ?? "(sense definir)"}
Resum: ${plan.summary}
${parentBlock}${childrenBlock}

Llocs al mapa:
${placesList}

Checklist:
${checklistList}
${headingsBlock}

Cos del pla (Markdown, pot incloure imatges \`![](pp:...)\`):
\`\`\`
${plan.body}
\`\`\`

Regles de resposta:
- Respon SEMPRE en català, to càlid i personal, com un amic que ajuda a planificar (no corporatiu).
- Sigues breu (1-4 paràgrafs) i útil. Pots usar llistes si convé.
- Si l'usuari et demana modificar el plan (afegir lloc, canviar body, etc.), respon-li que de moment només pots ajudar amb idees i preguntes; per editar ha d'anar al detall del plan (botó "Editar") o usar el Polish amb IA.

CÀLCULS I SÍNTESI (molt important):
Quan l'usuari pregunti sobre xifres (pressupost per país, durada, totals, mitjanes, comparacions, etc.), procedeix així pas a pas:

1. LLEGEIX TOT EL BODY DE NOU buscant TOTES les dades rellevants. NO et conformis amb la primera xifra que trobis ni saltis al pressupost global.
2. PRIORITZA dades específiques sobre agregades. Si el body té "Indonèsia: ~50€/dia" I també "Àsia: 5000-6500€", per a una pregunta sobre Indonèsia usa els 50€/dia específics, no la mitjana del total d'Àsia.
3. CROSS-REFERENCE: si tens dades específiques per país/secció I un agregat global, comprova si quadren. Si no, comenta la discrepància ("la suma per països dóna 4200€, l'agregat per Àsia és 5000-6500€ → la diferència cobreix imprevistos o altres països").
4. MOSTRA EL CÀLCUL component a component, no només el resultat: "Indonèsia: 28 dies × 50€/dia = 1400€ · Cambodja: 14 dies × 40€/dia = 560€ → Total: 1960€ per a la parella". Així l'usuari pot validar.
5. SI FALTEN dades concretes per algun tram, estima amb el que tens (mitjana de països veïns, costos similars) i DIGUES clarament els supòsits.
6. SI REALMENT no hi ha cap dada relacionada al body, aproxima sense inventar xifres i suggereix on afegir-la.

NO et limitis a "la info no és explícita" si pots desglossar i calcular amb el que hi ha. NO facis mitjanes uniformes si tens costos diferents per regió.

ENLLAÇOS (important):
- Quan remetis a una secció del body, prefereix una H3 específica abans que una H2 general. P.ex. si la pregunta és sobre vols, enllaça \`[Vols](#vols)\` en comptes de \`[Pressupost](#pressupost)\`.
- Sintaxi: \`[nom de la secció](#slug)\` usant SEMPRE els slugs exactes de la llista "Seccions del cos del plan". MAI inventis slugs.
- Per remetre al pla pare o a un sub-plan, usa \`[títol](/plans/slug-del-pla)\` amb els enllaços exactes que apareixen al context.
- Si no hi ha cap secció rellevant, no posis cap enllaç forçat.`;

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
