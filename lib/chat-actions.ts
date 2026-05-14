"use server";

import { GoogleGenAI } from "@google/genai";
import { revalidatePath } from "next/cache";
import { createSupabaseServer } from "./supabase-server";
import {
  buildCopilotSystemPrompt,
  COPILOT_FUNCTION_DECLARATIONS,
  type ChatMode,
  type Proposal,
  type ProposalStatus,
} from "./chat-prompt";
import { addPlace, geocodeSearch } from "./place-actions";

const apiKey = process.env.GOOGLE_AI_API_KEY;

function getClient(): GoogleGenAI {
  if (!apiKey) {
    throw new Error("Falta GOOGLE_AI_API_KEY a .env.local.");
  }
  return new GoogleGenAI({ apiKey });
}

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
  /** Propostes pendents/aplicades/cancel·lades. Només a missatges 'assistant'. */
  proposals?: Proposal[];
  createdAt: string;
};

function rowToMessage(r: {
  id: unknown;
  role: unknown;
  content: unknown;
  proposals?: unknown;
  created_at: unknown;
}): ChatMessage {
  return {
    id: r.id as string,
    role: r.role as "user" | "assistant",
    content: r.content as string,
    proposals: Array.isArray(r.proposals)
      ? (r.proposals as Proposal[])
      : undefined,
    createdAt: r.created_at as string,
  };
}

/** Tots els missatges d'un plan ordenats cronològicament. */
export async function getChatMessages(planId: string): Promise<ChatMessage[]> {
  const supabase = await createSupabaseServer();
  const { data, error } = await supabase
    .from("plan_messages")
    .select("id,role,content,proposals,created_at")
    .eq("plan_id", planId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(`Llegir missatges: ${error.message}`);
  return (data ?? []).map(rowToMessage);
}

export async function sendChatMessage(
  planId: string,
  userContent: string,
  mode: ChatMode = "edicio",
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
      .select("id,title,type,destination,start_date,end_date,summary,body")
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

  const systemInstruction = buildCopilotSystemPrompt({
    title: plan.title,
    // (passem `mode` com a segon argument més avall)
    type: plan.type,
    destination: plan.destination ?? undefined,
    startDate: plan.start_date ?? undefined,
    endDate: plan.end_date ?? undefined,
    summary: plan.summary,
    body: plan.body,
    places: (placesRes.data ?? []).map((p) => ({
      name: p.name as string,
      country: (p.country as string | null) ?? undefined,
    })),
    checklist: (checklistRes.data ?? []).map((c) => ({
      text: c.text as string,
      done: c.done as boolean,
    })),
    parent: parentRes.data
      ? {
          id: parentRes.data.id as string,
          title: parentRes.data.title as string,
          type: parentRes.data.type as string,
          destination: (parentRes.data.destination as string | null) ?? undefined,
          startDate: (parentRes.data.start_date as string | null) ?? undefined,
          endDate: (parentRes.data.end_date as string | null) ?? undefined,
          summary: parentRes.data.summary as string,
        }
      : null,
    children: (childrenRes.data ?? []).map((c) => ({
      id: c.id as string,
      title: c.title as string,
      type: c.type as string,
      destination: (c.destination as string | null) ?? undefined,
      startDate: (c.start_date as string | null) ?? undefined,
      endDate: (c.end_date as string | null) ?? undefined,
      summary: c.summary as string,
      body: (c.body as string | null) ?? undefined,
    })),
  }, mode);

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
        // 0.6 per recuperar elaboració textual quan hi ha tools; a mode
        // conversa podríem baixar però mantenim per consistència.
        temperature: 0.6,
        // Tools només en mode edició — així en mode conversa no hi ha risc
        // que el model proposi canvis accidentals.
        tools:
          mode === "edicio"
            ? [{ functionDeclarations: COPILOT_FUNCTION_DECLARATIONS }]
            : undefined,
      },
    });
  } catch (e) {
    throw translateGeminiError(e);
  }

  // Parseja el response per separar text i function calls.
  const parts = response.candidates?.[0]?.content?.parts ?? [];
  let replyText = "";
  const proposals: Proposal[] = [];

  for (const part of parts) {
    if (typeof part.text === "string" && part.text.length > 0) {
      replyText += part.text;
    }
    if (part.functionCall) {
      const name = part.functionCall.name;
      const args = (part.functionCall.args ?? {}) as Record<string, unknown>;
      if (
        name === "add_place" ||
        name === "add_checklist_item" ||
        name === "add_subplan"
      ) {
        proposals.push({
          id: crypto.randomUUID(),
          function_name: name,
          arguments: args,
          status: "pending",
        });
      }
    }
  }

  // Pre-geocoding d'add_place: el preview ha de mostrar la ubicació resolta
  // abans de demanar confirmació. Si Nominatim no troba res, ja marquem la
  // proposta com a failed perquè l'usuari pugui afinar la query sense haver
  // de clicar Aplicar i veure-ho fallar.
  await Promise.all(
    proposals.map(async (p) => {
      if (p.function_name !== "add_place") return;
      const query =
        typeof p.arguments.search_query === "string"
          ? p.arguments.search_query
          : "";
      if (!query) return;
      try {
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
      } catch (e) {
        p.status = "failed";
        p.result_message = `Error a Nominatim: ${e instanceof Error ? e.message : String(e)}`;
      }
    }),
  );

  // Si no hi ha res (ni text ni funció), és un error.
  if (!replyText.trim() && proposals.length === 0) {
    throw new Error("La IA no ha tornat resposta. Torna-ho a provar.");
  }
  // Si hi ha funcions però no text, afegim un text genèric perquè es vegi alguna
  // cosa a la bombolla mentre es renderitzen les propostes.
  if (!replyText.trim() && proposals.length > 0) {
    replyText =
      proposals.length === 1
        ? "T'ho deixo proposat per confirmar:"
        : `Et proposo ${proposals.length} canvis perquè els confirmis:`;
  }

  const userId = crypto.randomUUID();
  const assistantId = crypto.randomUUID();
  const { error: insertError } = await supabase.from("plan_messages").insert([
    { id: userId, plan_id: planId, role: "user", content: trimmed },
    {
      id: assistantId,
      plan_id: planId,
      role: "assistant",
      content: replyText,
      proposals: proposals.length > 0 ? proposals : null,
    },
  ]);
  if (insertError) throw new Error(`Desar missatges: ${insertError.message}`);

  return {
    id: assistantId,
    role: "assistant",
    content: replyText,
    proposals: proposals.length > 0 ? proposals : undefined,
    createdAt: new Date().toISOString(),
  };
}

// =====================================================================
// Executors: cada proposta acceptada acaba aquí.
// =====================================================================

type ExecuteResult = {
  success: boolean;
  message: string;
  path?: string;
};

async function executeAddPlace(
  planId: string,
  proposal: Proposal,
): Promise<ExecuteResult> {
  const args = proposal.arguments;
  const name = typeof args.name === "string" ? args.name.trim() : "";
  const query = typeof args.search_query === "string" ? args.search_query.trim() : "";
  const why = typeof args.why === "string" ? args.why.trim() : undefined;
  if (!name || !query) {
    return { success: false, message: "Manquen arguments (name + search_query)." };
  }

  // Si tenim preview pre-geocodificat (cas habitual), evitem una segona crida
  // a Nominatim. Si no, fem el geocoding ara.
  let resolved = proposal.preview?.geocoded;
  if (!resolved) {
    let geocode;
    try {
      geocode = await geocodeSearch(query);
    } catch (e) {
      return {
        success: false,
        message: `Error a Nominatim: ${e instanceof Error ? e.message : String(e)}`,
      };
    }
    const first = geocode[0];
    if (!first) {
      return {
        success: false,
        message: `OpenStreetMap no ha trobat coordenades per "${query}".`,
      };
    }
    resolved = first;
  }

  try {
    await addPlace(planId, {
      name,
      country: resolved.country,
      lat: resolved.lat,
      lng: resolved.lng,
      notes: why,
    });
  } catch (e) {
    return {
      success: false,
      message: `Error afegint lloc: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
  return {
    success: true,
    message: `Afegit "${name}"${resolved.country ? ` (${resolved.country})` : ""} al mapa.`,
  };
}

async function executeAddChecklistItem(
  planId: string,
  args: Record<string, unknown>,
): Promise<ExecuteResult> {
  const text = typeof args.text === "string" ? args.text.trim() : "";
  if (!text) return { success: false, message: "L'item no pot estar buit." };

  const supabase = await createSupabaseServer();

  // Evita duplicats: si ja hi ha un item amb el mateix text (case-insensitive),
  // no l'afegim de nou. El model no veu sempre la checklist actualitzada.
  const { data: existing } = await supabase
    .from("checklist_items")
    .select("id")
    .eq("plan_id", planId)
    .ilike("text", text)
    .limit(1);
  if (existing && existing.length > 0) {
    return { success: false, message: `Ja hi ha un item igual a la checklist: "${text}".` };
  }

  const { error } = await supabase.from("checklist_items").insert({
    id: crypto.randomUUID(),
    plan_id: planId,
    text,
    done: false,
  });
  if (error) {
    return { success: false, message: `Error afegint item: ${error.message}` };
  }
  return { success: true, message: `Afegit "${text}" a la checklist.` };
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

async function uniqueSlug(supabase: Awaited<ReturnType<typeof createSupabaseServer>>, base: string): Promise<string> {
  const { data } = await supabase
    .from("plans")
    .select("id")
    .like("id", `${base}%`);
  const taken = new Set((data ?? []).map((r) => r.id as string));
  if (!taken.has(base)) return base;
  for (let i = 2; i < 1000; i++) {
    const c = `${base}-${i}`;
    if (!taken.has(c)) return c;
  }
  return `${base}-${Date.now()}`;
}

async function executeAddSubplan(
  parentPlanId: string,
  args: Record<string, unknown>,
): Promise<ExecuteResult> {
  const title = typeof args.title === "string" ? args.title.trim() : "";
  const planType =
    args.plan_type === "deep" || args.plan_type === "weekend" || args.plan_type === "day"
      ? args.plan_type
      : null;
  const summary = typeof args.summary === "string" ? args.summary.trim() : "";
  if (!title || !planType || !summary) {
    return { success: false, message: "Manquen title/plan_type/summary." };
  }
  const destination =
    typeof args.destination === "string" && args.destination.trim()
      ? args.destination.trim()
      : null;
  const isDateStr = (s: unknown): s is string =>
    typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
  const start_date = isDateStr(args.start_date) ? args.start_date : null;
  const end_date = isDateStr(args.end_date) ? args.end_date : null;
  if (start_date && end_date && start_date > end_date) {
    return { success: false, message: "Data inici posterior a la de fi." };
  }

  const supabase = await createSupabaseServer();
  const base = slugify(title);
  const id = await uniqueSlug(supabase, base);
  const now = new Date().toISOString();

  // Cover de fallback per defecte (mateix que als COVER_PRESETS del form).
  const cover =
    "linear-gradient(135deg, #F4A26E 0%, #E27A45 45%, #6B97A8 100%)";

  const { error } = await supabase.from("plans").insert({
    id,
    title,
    type: planType,
    status: "planning",
    cover,
    destination,
    start_date: planType === "day" ? start_date : start_date,
    end_date: planType === "day" ? start_date : end_date,
    summary,
    body: `## La idea\n\n${summary}\n\n## Pendents\n\n- Completar aquest sub-plan`,
    parent_plan_id: parentPlanId,
    created_at: now,
    updated_at: now,
  });
  if (error) {
    return { success: false, message: `Error creant sub-plan: ${error.message}` };
  }
  return {
    success: true,
    message: `Creat sub-plan "${title}".`,
    path: `/plans/${id}`,
  };
}

async function executeProposal(
  planId: string,
  proposal: Proposal,
): Promise<ExecuteResult> {
  switch (proposal.function_name) {
    case "add_place":
      return executeAddPlace(planId, proposal);
    case "add_checklist_item":
      return executeAddChecklistItem(planId, proposal.arguments);
    case "add_subplan":
      return executeAddSubplan(planId, proposal.arguments);
    default:
      return { success: false, message: `Funció desconeguda: ${proposal.function_name}` };
  }
}

async function updateProposalStatus(
  planId: string,
  messageId: string,
  proposalId: string,
  patch: Partial<Pick<Proposal, "status" | "result_message" | "result_path" | "applied_at">>,
): Promise<ChatMessage> {
  const supabase = await createSupabaseServer();

  const { data: msg, error: readErr } = await supabase
    .from("plan_messages")
    .select("id,role,content,proposals,created_at,plan_id")
    .eq("id", messageId)
    .eq("plan_id", planId)
    .single();
  if (readErr || !msg) throw new Error("Missatge no trobat");
  const proposals = (msg.proposals as Proposal[] | null) ?? [];
  const idx = proposals.findIndex((p) => p.id === proposalId);
  if (idx === -1) throw new Error("Proposta no trobada");
  proposals[idx] = { ...proposals[idx], ...patch };

  const { error: writeErr } = await supabase
    .from("plan_messages")
    .update({ proposals })
    .eq("id", messageId);
  if (writeErr) throw new Error(`Desar proposta: ${writeErr.message}`);

  return rowToMessage({ ...msg, proposals });
}

export async function applyProposal(
  planId: string,
  messageId: string,
  proposalId: string,
): Promise<ChatMessage> {
  // Llegim la proposta original per veure quina funció executar.
  const supabase = await createSupabaseServer();
  const { data: msg, error } = await supabase
    .from("plan_messages")
    .select("proposals")
    .eq("id", messageId)
    .eq("plan_id", planId)
    .single();
  if (error || !msg) throw new Error("Missatge no trobat");
  const proposals = (msg.proposals as Proposal[] | null) ?? [];
  const proposal = proposals.find((p) => p.id === proposalId);
  if (!proposal) throw new Error("Proposta no trobada");
  if (proposal.status !== "pending") {
    throw new Error("Aquesta proposta ja s'ha resolt.");
  }

  const result = await executeProposal(planId, proposal);
  const status: ProposalStatus = result.success ? "applied" : "failed";

  const updated = await updateProposalStatus(planId, messageId, proposalId, {
    status,
    result_message: result.message,
    result_path: result.path,
    applied_at: new Date().toISOString(),
  });

  revalidatePath(`/plans/${planId}`);
  return updated;
}

export async function cancelProposal(
  planId: string,
  messageId: string,
  proposalId: string,
): Promise<ChatMessage> {
  return updateProposalStatus(planId, messageId, proposalId, {
    status: "cancelled",
    applied_at: new Date().toISOString(),
  });
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
