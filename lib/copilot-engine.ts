// Motor del copilot (sense "use server"): tota la generació d'una resposta —
// construir context/prompt, cridar Gemini (streaming), parsejar text + function
// calls i pre-resoldre previews. El fan servir tant el server action
// `sendChatMessage` (no streaming) com el route handler de streaming.
//
// Les server actions (apply/cancel/executors) viuen a `chat-actions.ts`, que
// importa d'aquí els helpers de resolució i `runCopilotTurn`/`persistCopilotExchange`.

import { GoogleGenAI } from "@google/genai";
import { createSupabaseServer } from "./supabase-server";
import {
  buildCopilotSystemPrompt,
  COPILOT_FUNCTION_DECLARATIONS,
  SUBPLAN_FUNCTION_NAMES,
  PARENT_FUNCTION_NAMES,
  type ChatMode,
  type Proposal,
  type ProposalFunctionName,
} from "./chat-prompt";
import { geocodeSearch } from "./place-actions";

const apiKey = process.env.GOOGLE_AI_API_KEY;

function getClient(): GoogleGenAI {
  if (!apiKey) {
    throw new Error("Falta GOOGLE_AI_API_KEY a .env.local.");
  }
  return new GoogleGenAI({ apiKey });
}

export function translateGeminiError(e: unknown): Error {
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

// Noms vàlids de funció derivats de les declaracions — única font de veritat.
const VALID_FUNCTION_NAMES = new Set<ProposalFunctionName>(
  COPILOT_FUNCTION_DECLARATIONS.map((d) => d.name as ProposalFunctionName),
);

// =====================================================================
// Resolució de plans relacionats (compartida amb els executors).
// =====================================================================

export type ChildPlanRow = {
  id: string;
  title: string;
  summary: string;
  destination: string | null;
  start_date: string | null;
  end_date: string | null;
  body: string | null;
};

export type ResolveChildResult =
  | { ok: true; row: ChildPlanRow }
  | { ok: false; message: string };

function rowToChildPlan(row: Record<string, unknown>): ChildPlanRow {
  return {
    id: row.id as string,
    title: row.title as string,
    summary: row.summary as string,
    destination: (row.destination as string | null) ?? null,
    start_date: (row.start_date as string | null) ?? null,
    end_date: (row.end_date as string | null) ?? null,
    body: (row.body as string | null) ?? null,
  };
}

type Supa = Awaited<ReturnType<typeof createSupabaseServer>>;

/**
 * Resol i VALIDA que `targetId` penja de `rootPlanId` com a fill directe O net
 * (≤2 salts per `parent_plan_id`). Defensa contra ids al·lucinats.
 */
export async function resolveDescendantPlan(
  supabase: Supa,
  rootPlanId: string,
  targetId: string,
): Promise<ResolveChildResult> {
  if (!targetId) return { ok: false, message: "Manca subplan_id." };
  const { data: row } = await supabase
    .from("plans")
    .select("id,title,summary,destination,start_date,end_date,body,parent_plan_id")
    .eq("id", targetId)
    .maybeSingle();
  if (!row) return { ok: false, message: "El sub-plan no existeix." };

  let isDescendant = row.parent_plan_id === rootPlanId;
  if (!isDescendant && row.parent_plan_id) {
    const { data: mid } = await supabase
      .from("plans")
      .select("parent_plan_id")
      .eq("id", row.parent_plan_id as string)
      .maybeSingle();
    isDescendant = (mid?.parent_plan_id ?? null) === rootPlanId;
  }
  if (!isDescendant) {
    return { ok: false, message: "El sub-plan no existeix o no penja d'aquest plan." };
  }
  return { ok: true, row: rowToChildPlan(row) };
}

/** Resol el pla PARE del pla actual (error si no en té). Per a les funcions *_parent. */
export async function resolveParentPlan(
  supabase: Supa,
  currentPlanId: string,
): Promise<ResolveChildResult> {
  const { data: cur } = await supabase
    .from("plans")
    .select("parent_plan_id")
    .eq("id", currentPlanId)
    .maybeSingle();
  if (!cur?.parent_plan_id) {
    return { ok: false, message: "Aquest pla no té pla pare." };
  }
  const { data: row } = await supabase
    .from("plans")
    .select("id,title,summary,destination,start_date,end_date,body")
    .eq("id", cur.parent_plan_id as string)
    .maybeSingle();
  if (!row) return { ok: false, message: "El pla pare no existeix." };
  return { ok: true, row: rowToChildPlan(row) };
}

// =====================================================================
// Generació d'una resposta del copilot.
// =====================================================================

export type CopilotTurn = { replyText: string; proposals: Proposal[] };

/**
 * Genera una resposta del copilot per a `userContent`. Si es passa `onTextDelta`,
 * crida Gemini en streaming i emet els fragments de text a mesura que arriben.
 * Retorna el text complet i les propostes (amb previews pre-resoltes). NO persisteix.
 */
export async function runCopilotTurn(
  planId: string,
  userContent: string,
  mode: ChatMode,
  onTextDelta?: (delta: string) => void,
): Promise<CopilotTurn> {
  const supabase = await createSupabaseServer();

  const { data: plan, error: planError } = await supabase
    .from("plans")
    .select("id,title,type,destination,start_date,end_date,summary,body,parent_plan_id")
    .eq("id", planId)
    .single();
  if (planError || !plan) throw new Error("Plan no trobat");

  const PLAN_COLS = "id,title,type,destination,start_date,end_date,summary,body";
  const [parentRes, childrenRes, placesRes, checklistRes, messagesRes] = await Promise.all([
    plan.parent_plan_id
      ? supabase.from("plans").select(PLAN_COLS).eq("id", plan.parent_plan_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("plans")
      .select(PLAN_COLS)
      .eq("parent_plan_id", planId)
      .order("start_date", { ascending: true, nullsFirst: false }),
    supabase.from("places").select("id,name,country").eq("plan_id", planId).order("order_index"),
    supabase.from("checklist_items").select("id,text,done").eq("plan_id", planId),
    supabase
      .from("plan_messages")
      .select("role,content")
      .eq("plan_id", planId)
      .order("created_at", { ascending: true }),
  ]);

  const childIds = (childrenRes.data ?? []).map((c) => c.id as string);

  const grandRes =
    childIds.length > 0
      ? await supabase
          .from("plans")
          .select(`${PLAN_COLS},parent_plan_id`)
          .in("parent_plan_id", childIds)
          .order("start_date", { ascending: true, nullsFirst: false })
      : { data: [] as Array<Record<string, unknown>> };
  const grandByChild = new Map<string, Array<Record<string, unknown>>>();
  for (const g of grandRes.data ?? []) {
    const pid = g.parent_plan_id as string;
    if (!grandByChild.has(pid)) grandByChild.set(pid, []);
    grandByChild.get(pid)!.push(g);
  }

  const contentIds = [
    ...(plan.parent_plan_id ? [plan.parent_plan_id as string] : []),
    ...childIds,
    ...(grandRes.data ?? []).map((g) => g.id as string),
  ];
  const [contentChecklistRes, contentPlacesRes] = await Promise.all([
    contentIds.length > 0
      ? supabase.from("checklist_items").select("id,text,done,plan_id").in("plan_id", contentIds)
      : Promise.resolve({ data: [] as Array<Record<string, unknown>> }),
    contentIds.length > 0
      ? supabase.from("places").select("id,name,country,plan_id").in("plan_id", contentIds).order("order_index")
      : Promise.resolve({ data: [] as Array<Record<string, unknown>> }),
  ]);
  const checklistByPlan = new Map<string, Array<{ id: string; text: string; done: boolean }>>();
  for (const row of contentChecklistRes.data ?? []) {
    const pid = row.plan_id as string;
    if (!checklistByPlan.has(pid)) checklistByPlan.set(pid, []);
    checklistByPlan.get(pid)!.push({
      id: row.id as string,
      text: row.text as string,
      done: row.done as boolean,
    });
  }
  const placesByPlan = new Map<string, Array<{ id: string; name: string; country?: string }>>();
  for (const row of contentPlacesRes.data ?? []) {
    const pid = row.plan_id as string;
    if (!placesByPlan.has(pid)) placesByPlan.set(pid, []);
    placesByPlan.get(pid)!.push({
      id: row.id as string,
      name: row.name as string,
      country: (row.country as string | null) ?? undefined,
    });
  }

  const toNode = (r: Record<string, unknown>) => {
    const id = r.id as string;
    return {
      id,
      title: r.title as string,
      type: r.type as string,
      destination: (r.destination as string | null) ?? undefined,
      startDate: (r.start_date as string | null) ?? undefined,
      endDate: (r.end_date as string | null) ?? undefined,
      summary: r.summary as string,
      body: (r.body as string | null) ?? undefined,
      checklist: checklistByPlan.get(id) ?? [],
      places: placesByPlan.get(id) ?? [],
    };
  };

  const systemInstruction = buildCopilotSystemPrompt(
    {
      title: plan.title,
      type: plan.type,
      destination: plan.destination ?? undefined,
      startDate: plan.start_date ?? undefined,
      endDate: plan.end_date ?? undefined,
      summary: plan.summary,
      body: plan.body,
      places: (placesRes.data ?? []).map((p) => ({
        id: p.id as string,
        name: p.name as string,
        country: (p.country as string | null) ?? undefined,
      })),
      checklist: (checklistRes.data ?? []).map((c) => ({
        id: c.id as string,
        text: c.text as string,
        done: c.done as boolean,
      })),
      parent: parentRes.data ? toNode(parentRes.data) : null,
      children: (childrenRes.data ?? []).map((c) => ({
        ...toNode(c),
        children: (grandByChild.get(c.id as string) ?? []).map(toNode),
      })),
    },
    mode,
  );

  const recentMessages = (messagesRes.data ?? []).slice(-20);
  const history = recentMessages.map((m) => ({
    role: m.role === "user" ? "user" : "model",
    parts: [{ text: m.content as string }],
  }));
  history.push({ role: "user", parts: [{ text: userContent }] });

  const client = getClient();
  let replyText = "";
  const proposals: Proposal[] = [];
  const pushCall = (name?: string, args?: Record<string, unknown>) => {
    if (name && VALID_FUNCTION_NAMES.has(name as ProposalFunctionName)) {
      proposals.push({
        id: crypto.randomUUID(),
        function_name: name as ProposalFunctionName,
        arguments: (args ?? {}) as Record<string, unknown>,
        status: "pending",
      });
    }
  };

  try {
    const stream = await client.models.generateContentStream({
      model: "gemini-2.5-flash",
      contents: history,
      config: {
        systemInstruction,
        temperature: 0.6,
        tools:
          mode === "edicio"
            ? [{ functionDeclarations: COPILOT_FUNCTION_DECLARATIONS }]
            : undefined,
      },
    });
    for await (const chunk of stream) {
      const parts = chunk.candidates?.[0]?.content?.parts ?? [];
      for (const part of parts) {
        if (typeof part.text === "string" && part.text.length > 0) {
          replyText += part.text;
          onTextDelta?.(part.text);
        }
        if (part.functionCall) {
          pushCall(part.functionCall.name, part.functionCall.args as Record<string, unknown>);
        }
      }
    }
  } catch (e) {
    throw translateGeminiError(e);
  }

  await resolveProposalPreviews(supabase, planId, plan as Record<string, unknown>, proposals);

  // Si hi ha funcions però no text, afegim un text genèric perquè es vegi alguna
  // cosa a la bombolla mentre es renderitzen les propostes.
  if (!replyText.trim() && proposals.length > 0) {
    replyText =
      proposals.length === 1
        ? "T'ho deixo proposat per confirmar:"
        : `Et proposo ${proposals.length} canvis perquè els confirmis:`;
  }
  if (!replyText.trim() && proposals.length === 0) {
    throw new Error("La IA no ha tornat resposta. Torna-ho a provar.");
  }

  return { replyText, proposals };
}

/** Persisteix l'intercanvi (missatge user + assistant) i retorna l'id de l'assistant. */
export async function persistCopilotExchange(
  planId: string,
  userContent: string,
  replyText: string,
  proposals: Proposal[],
): Promise<string> {
  const supabase = await createSupabaseServer();
  const userId = crypto.randomUUID();
  const assistantId = crypto.randomUUID();
  const { error: insertError } = await supabase.from("plan_messages").insert([
    { id: userId, plan_id: planId, role: "user", content: userContent },
    {
      id: assistantId,
      plan_id: planId,
      role: "assistant",
      content: replyText,
      proposals: proposals.length > 0 ? proposals : null,
    },
  ]);
  if (insertError) throw new Error(`Desar missatges: ${insertError.message}`);
  return assistantId;
}

// =====================================================================
// Pre-resolució de previews per a cada proposta.
// =====================================================================

async function resolveProposalPreviews(
  supabase: Supa,
  planId: string,
  plan: Record<string, unknown>,
  proposals: Proposal[],
): Promise<void> {
  await Promise.all(
    proposals.map(async (p) => {
      try {
        if (p.function_name === "add_place") {
          const query =
            typeof p.arguments.search_query === "string" ? p.arguments.search_query : "";
          if (!query) return;
          const results = await geocodeSearch(query);
          const first = results[0];
          if (first) {
            p.preview = {
              geocoded: {
                name: first.name,
                country: first.country,
                lat: first.lat,
                lng: first.lng,
                displayName: first.displayName,
              },
            };
          } else {
            p.status = "failed";
            p.result_message = `OpenStreetMap no ha trobat "${query}". Prova amb més detall (ciutat, país).`;
          }
          return;
        }

        if (p.function_name === "delete_place") {
          const placeId = typeof p.arguments.place_id === "string" ? p.arguments.place_id : "";
          if (!placeId) {
            p.status = "failed";
            p.result_message = "Manca place_id.";
            return;
          }
          const { data: row } = await supabase
            .from("places")
            .select("name,country,plan_id")
            .eq("id", placeId)
            .maybeSingle();
          if (!row || row.plan_id !== planId) {
            p.status = "failed";
            p.result_message = "El lloc no existeix o no pertany a aquest plan.";
            return;
          }
          p.preview = {
            place_before: {
              name: row.name as string,
              country: (row.country as string | null) ?? undefined,
            },
          };
          return;
        }

        if (p.function_name === "update_checklist_item") {
          const itemId = typeof p.arguments.item_id === "string" ? p.arguments.item_id : "";
          if (!itemId) {
            p.status = "failed";
            p.result_message = "Manca item_id.";
            return;
          }
          const { data: row } = await supabase
            .from("checklist_items")
            .select("text,done,plan_id")
            .eq("id", itemId)
            .maybeSingle();
          if (!row || row.plan_id !== planId) {
            p.status = "failed";
            p.result_message = "L'ítem no existeix o no pertany a aquest plan.";
            return;
          }
          p.preview = {
            item_before: { text: row.text as string, done: row.done as boolean },
          };
          return;
        }

        if (p.function_name === "update_plan_metadata") {
          const args = p.arguments;
          const before: NonNullable<Proposal["preview"]>["metadata_before"] = {};
          if (typeof args.title === "string") before.title = plan.title as string;
          if (typeof args.summary === "string") before.summary = plan.summary as string;
          if (typeof args.destination === "string") {
            before.destination = (plan.destination as string | null) ?? "";
          }
          if (typeof args.start_date === "string") {
            before.start_date = (plan.start_date as string | null) ?? "";
          }
          if (typeof args.end_date === "string") {
            before.end_date = (plan.end_date as string | null) ?? "";
          }
          if (Object.keys(before).length === 0) {
            p.status = "failed";
            p.result_message = "Cap camp vàlid per actualitzar.";
            return;
          }
          p.preview = { metadata_before: before };
          return;
        }

        if (p.function_name === "update_plan_body") {
          const newBody = typeof p.arguments.new_body === "string" ? p.arguments.new_body : "";
          if (!newBody) {
            p.status = "failed";
            p.result_message = "Body nou buit.";
            return;
          }
          const beforeBody = (plan.body as string | null) ?? "";
          p.preview = {
            body_stats: {
              before_chars: beforeBody.length,
              before_lines: beforeBody.split("\n").length,
              after_chars: newBody.length,
              after_lines: newBody.split("\n").length,
            },
          };
          return;
        }

        // ---------- Variants de SUB-PLAN (fills i nets) ----------
        if (SUBPLAN_FUNCTION_NAMES.has(p.function_name)) {
          const child = await resolveDescendantPlan(
            supabase,
            planId,
            typeof p.arguments.subplan_id === "string" ? p.arguments.subplan_id : "",
          );
          if (!child.ok) {
            p.status = "failed";
            p.result_message = child.message;
            return;
          }
          const sub = child.row;
          p.preview = { subplan: { id: sub.id, title: sub.title } };

          if (p.function_name === "update_subplan_body") {
            const newBody = typeof p.arguments.new_body === "string" ? p.arguments.new_body : "";
            if (!newBody) {
              p.status = "failed";
              p.result_message = "Body nou buit.";
              return;
            }
            const beforeBody = sub.body ?? "";
            p.preview.body_stats = {
              before_chars: beforeBody.length,
              before_lines: beforeBody.split("\n").length,
              after_chars: newBody.length,
              after_lines: newBody.split("\n").length,
            };
            return;
          }

          if (p.function_name === "update_subplan_metadata") {
            const args = p.arguments;
            const before: NonNullable<Proposal["preview"]>["metadata_before"] = {};
            if (typeof args.title === "string") before.title = sub.title;
            if (typeof args.summary === "string") before.summary = sub.summary;
            if (typeof args.destination === "string") before.destination = sub.destination ?? "";
            if (typeof args.start_date === "string") before.start_date = sub.start_date ?? "";
            if (typeof args.end_date === "string") before.end_date = sub.end_date ?? "";
            if (Object.keys(before).length === 0) {
              p.status = "failed";
              p.result_message = "Cap camp vàlid per actualitzar.";
              return;
            }
            p.preview.metadata_before = before;
            return;
          }

          if (p.function_name === "update_subplan_checklist_item") {
            const itemId = typeof p.arguments.item_id === "string" ? p.arguments.item_id : "";
            if (!itemId) {
              p.status = "failed";
              p.result_message = "Manca item_id.";
              return;
            }
            const { data: row } = await supabase
              .from("checklist_items")
              .select("text,done,plan_id")
              .eq("id", itemId)
              .maybeSingle();
            if (!row || row.plan_id !== sub.id) {
              p.status = "failed";
              p.result_message = "L'ítem no existeix o no pertany a aquest sub-plan.";
              return;
            }
            p.preview.item_before = { text: row.text as string, done: row.done as boolean };
            return;
          }

          if (p.function_name === "delete_subplan_place") {
            const placeId = typeof p.arguments.place_id === "string" ? p.arguments.place_id : "";
            if (!placeId) {
              p.status = "failed";
              p.result_message = "Manca place_id.";
              return;
            }
            const { data: row } = await supabase
              .from("places")
              .select("name,country,plan_id")
              .eq("id", placeId)
              .maybeSingle();
            if (!row || row.plan_id !== sub.id) {
              p.status = "failed";
              p.result_message = "El lloc no existeix o no pertany a aquest sub-plan.";
              return;
            }
            p.preview.place_before = {
              name: row.name as string,
              country: (row.country as string | null) ?? undefined,
            };
            return;
          }

          if (p.function_name === "add_subplan_place") {
            const query =
              typeof p.arguments.search_query === "string" ? p.arguments.search_query : "";
            if (!query) return;
            const results = await geocodeSearch(query);
            const first = results[0];
            if (first) {
              p.preview.geocoded = {
                name: first.name,
                country: first.country,
                lat: first.lat,
                lng: first.lng,
                displayName: first.displayName,
              };
            } else {
              p.status = "failed";
              p.result_message = `OpenStreetMap no ha trobat "${query}". Prova amb més detall (ciutat, país).`;
            }
            return;
          }
          // add_subplan_checklist_item: només cal l'etiqueta del sub-plan.
          return;
        }

        // ---------- Variants de PLA PARE ----------
        if (PARENT_FUNCTION_NAMES.has(p.function_name)) {
          const parent = await resolveParentPlan(supabase, planId);
          if (!parent.ok) {
            p.status = "failed";
            p.result_message = parent.message;
            return;
          }
          const par = parent.row;
          p.preview = { parent: { id: par.id, title: par.title } };

          if (p.function_name === "update_parent_body") {
            const newBody = typeof p.arguments.new_body === "string" ? p.arguments.new_body : "";
            if (!newBody) {
              p.status = "failed";
              p.result_message = "Body nou buit.";
              return;
            }
            const beforeBody = par.body ?? "";
            p.preview.body_stats = {
              before_chars: beforeBody.length,
              before_lines: beforeBody.split("\n").length,
              after_chars: newBody.length,
              after_lines: newBody.split("\n").length,
            };
            return;
          }

          if (p.function_name === "update_parent_metadata") {
            const args = p.arguments;
            const before: NonNullable<Proposal["preview"]>["metadata_before"] = {};
            if (typeof args.title === "string") before.title = par.title;
            if (typeof args.summary === "string") before.summary = par.summary;
            if (typeof args.destination === "string") before.destination = par.destination ?? "";
            if (typeof args.start_date === "string") before.start_date = par.start_date ?? "";
            if (typeof args.end_date === "string") before.end_date = par.end_date ?? "";
            if (Object.keys(before).length === 0) {
              p.status = "failed";
              p.result_message = "Cap camp vàlid per actualitzar.";
              return;
            }
            p.preview.metadata_before = before;
            return;
          }

          if (p.function_name === "update_parent_checklist_item") {
            const itemId = typeof p.arguments.item_id === "string" ? p.arguments.item_id : "";
            if (!itemId) {
              p.status = "failed";
              p.result_message = "Manca item_id.";
              return;
            }
            const { data: row } = await supabase
              .from("checklist_items")
              .select("text,done,plan_id")
              .eq("id", itemId)
              .maybeSingle();
            if (!row || row.plan_id !== par.id) {
              p.status = "failed";
              p.result_message = "L'ítem no existeix o no pertany al pla pare.";
              return;
            }
            p.preview.item_before = { text: row.text as string, done: row.done as boolean };
            return;
          }

          if (p.function_name === "delete_parent_place") {
            const placeId = typeof p.arguments.place_id === "string" ? p.arguments.place_id : "";
            if (!placeId) {
              p.status = "failed";
              p.result_message = "Manca place_id.";
              return;
            }
            const { data: row } = await supabase
              .from("places")
              .select("name,country,plan_id")
              .eq("id", placeId)
              .maybeSingle();
            if (!row || row.plan_id !== par.id) {
              p.status = "failed";
              p.result_message = "El lloc no existeix o no pertany al pla pare.";
              return;
            }
            p.preview.place_before = {
              name: row.name as string,
              country: (row.country as string | null) ?? undefined,
            };
            return;
          }

          if (p.function_name === "add_parent_place") {
            const query =
              typeof p.arguments.search_query === "string" ? p.arguments.search_query : "";
            if (!query) return;
            const results = await geocodeSearch(query);
            const first = results[0];
            if (first) {
              p.preview.geocoded = {
                name: first.name,
                country: first.country,
                lat: first.lat,
                lng: first.lng,
                displayName: first.displayName,
              };
            } else {
              p.status = "failed";
              p.result_message = `OpenStreetMap no ha trobat "${query}". Prova amb més detall (ciutat, país).`;
            }
            return;
          }
          // add_parent_checklist_item: només cal l'etiqueta del pare.
          return;
        }
      } catch (e) {
        p.status = "failed";
        p.result_message = `Error preparant proposta: ${e instanceof Error ? e.message : String(e)}`;
      }
    }),
  );
}
