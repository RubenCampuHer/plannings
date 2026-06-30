"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServer } from "./supabase-server";
import { type ChatMode, type Proposal, type ProposalStatus } from "./chat-prompt";
import { addPlace, geocodeSearch } from "./place-actions";
import {
  runCopilotTurn,
  persistCopilotExchange,
  resolveDescendantPlan,
  resolveParentPlan,
  placeInScope,
} from "./copilot-engine";

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

  // M12: quota (consumeQuota "polish_text") pendent de reintegrar amb quota-actions.

  // Generació no-streaming (reutilitza el motor compartit amb el route de streaming).
  const { replyText, proposals } = await runCopilotTurn(planId, trimmed, mode);
  const assistantId = await persistCopilotExchange(
    planId,
    trimmed,
    replyText,
    proposals,
  );

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
  const arrivalDate =
    typeof args.arrival_date === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(args.arrival_date)
      ? args.arrival_date
      : undefined;
  const zone =
    typeof args.zone === "string" && args.zone.trim() ? args.zone.trim() : undefined;
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
      arrivalDate,
      zone,
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
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, message: "Cal estar autenticat per crear un sub-plan." };
  }
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
    owner_id: user.id,
    created_at: now,
    updated_at: now,
  });
  if (error) {
    return { success: false, message: `Error creant sub-plan: ${error.message}` };
  }

  const { error: memberError } = await supabase
    .from("plan_members")
    .insert({ plan_id: id, user_id: user.id });
  if (memberError) {
    return { success: false, message: `Error afegint creator a sub-plan: ${memberError.message}` };
  }
  return {
    success: true,
    message: `Creat sub-plan "${title}".`,
    path: `/plans/${id}`,
  };
}

async function executeUpdatePlanMetadata(
  planId: string,
  args: Record<string, unknown>,
): Promise<ExecuteResult> {
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  const changed: string[] = [];
  if (typeof args.title === "string" && args.title.trim()) {
    patch.title = args.title.trim();
    changed.push("títol");
  }
  if (typeof args.summary === "string") {
    patch.summary = args.summary.trim();
    changed.push("resum");
  }
  if (typeof args.destination === "string") {
    const v = args.destination.trim();
    patch.destination = v.length > 0 ? v : null;
    changed.push("destinació");
  }
  const isDateStr = (s: unknown): s is string =>
    typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
  if (isDateStr(args.start_date)) {
    patch.start_date = args.start_date;
    changed.push("data inici");
  }
  if (isDateStr(args.end_date)) {
    patch.end_date = args.end_date;
    changed.push("data fi");
  }
  if (changed.length === 0) {
    return { success: false, message: "Cap camp vàlid per actualitzar." };
  }
  const supabase = await createSupabaseServer();
  const { error } = await supabase.from("plans").update(patch).eq("id", planId);
  if (error) {
    return { success: false, message: `Error actualitzant: ${error.message}` };
  }
  return { success: true, message: `Actualitzat: ${changed.join(", ")}.` };
}

async function executeUpdatePlanBody(
  planId: string,
  args: Record<string, unknown>,
): Promise<ExecuteResult> {
  const newBody = typeof args.new_body === "string" ? args.new_body : "";
  if (!newBody.trim()) {
    return { success: false, message: "El nou body no pot estar buit." };
  }
  const patch: Record<string, unknown> = {
    body: newBody,
    updated_at: new Date().toISOString(),
  };
  // "Summary a nivell d'índex": si el model regenera el resum amb el body, el
  // guardem alhora perquè la targeta/entradilla quedin al dia.
  let summaryUpdated = false;
  if (typeof args.summary === "string" && args.summary.trim()) {
    patch.summary = args.summary.trim();
    summaryUpdated = true;
  }
  const supabase = await createSupabaseServer();
  const { error } = await supabase.from("plans").update(patch).eq("id", planId);
  if (error) {
    return { success: false, message: `Error actualitzant body: ${error.message}` };
  }
  return {
    success: true,
    message: summaryUpdated ? "Body i resum actualitzats." : "Body actualitzat.",
  };
}

async function executeDeletePlace(
  planId: string,
  args: Record<string, unknown>,
): Promise<ExecuteResult> {
  const placeId = typeof args.place_id === "string" ? args.place_id : "";
  if (!placeId) return { success: false, message: "Manca place_id." };
  const supabase = await createSupabaseServer();
  // Comprova que pertany al plan abans d'esborrar — defensa contra
  // alucinacions d'id del model.
  const { data: row } = await supabase
    .from("places")
    .select("name,plan_id")
    .eq("id", placeId)
    .maybeSingle();
  if (!row || row.plan_id !== planId) {
    return { success: false, message: "El lloc no existeix o no pertany a aquest plan." };
  }
  const { error } = await supabase.from("places").delete().eq("id", placeId);
  if (error) {
    return { success: false, message: `Error esborrant: ${error.message}` };
  }
  return { success: true, message: `Esborrat "${row.name}" del mapa.` };
}

async function executeUpdateChecklistItem(
  planId: string,
  args: Record<string, unknown>,
): Promise<ExecuteResult> {
  const itemId = typeof args.item_id === "string" ? args.item_id : "";
  if (!itemId) return { success: false, message: "Manca item_id." };
  const patch: Record<string, unknown> = {};
  if (typeof args.text === "string" && args.text.trim()) {
    patch.text = args.text.trim();
  }
  if (typeof args.done === "boolean") {
    patch.done = args.done;
  }
  if (Object.keys(patch).length === 0) {
    return { success: false, message: "Cap camp vàlid per actualitzar (text o done)." };
  }
  const supabase = await createSupabaseServer();
  const { data: row } = await supabase
    .from("checklist_items")
    .select("plan_id")
    .eq("id", itemId)
    .maybeSingle();
  if (!row || row.plan_id !== planId) {
    return { success: false, message: "L'ítem no existeix o no pertany a aquest plan." };
  }
  const { error } = await supabase
    .from("checklist_items")
    .update(patch)
    .eq("id", itemId);
  if (error) {
    return { success: false, message: `Error actualitzant ítem: ${error.message}` };
  }
  return { success: true, message: "Ítem actualitzat." };
}

// ---------- Executors de SUB-PLAN ----------
// Wrappers prims: validen que el target és fill del plan actual i deleguen a
// l'executor genèric corresponent passant l'id del sub-plan. Així reutilitzem
// tota la lògica d'escriptura/validació de dades.

async function withResolvedChild(
  rootPlanId: string,
  proposal: Proposal,
  run: (childId: string) => Promise<ExecuteResult>,
): Promise<ExecuteResult> {
  const supabase = await createSupabaseServer();
  const subplanId =
    typeof proposal.arguments.subplan_id === "string"
      ? proposal.arguments.subplan_id
      : "";
  // Accepta fill directe O net (≤2 salts).
  const child = await resolveDescendantPlan(supabase, rootPlanId, subplanId);
  if (!child.ok) return { success: false, message: child.message };
  const result = await run(child.row.id);
  if (result.success) {
    revalidatePath(`/plans/${child.row.id}`);
    // Enllaç a la card d'èxit perquè l'usuari pugui saltar al sub-plan editat.
    if (!result.path) result.path = `/plans/${child.row.id}`;
  }
  return result;
}

// ---------- Executor de PLA PARE ----------
// Resol el pare del pla actual i delega als executors genèrics amb el seu id.
async function withResolvedParent(
  currentPlanId: string,
  run: (parentId: string) => Promise<ExecuteResult>,
): Promise<ExecuteResult> {
  const supabase = await createSupabaseServer();
  const parent = await resolveParentPlan(supabase, currentPlanId);
  if (!parent.ok) return { success: false, message: parent.message };
  const result = await run(parent.row.id);
  if (result.success) {
    revalidatePath(`/plans/${parent.row.id}`);
    if (!result.path) result.path = `/plans/${parent.row.id}`;
  }
  return result;
}

async function executeSetPlaceZone(
  planId: string,
  args: Record<string, unknown>,
): Promise<ExecuteResult> {
  const placeId = typeof args.place_id === "string" ? args.place_id : "";
  const zone = typeof args.zone === "string" ? args.zone.trim() : "";
  if (!placeId || !zone) {
    return { success: false, message: "Manquen place_id o zone." };
  }
  const arrivalDate =
    typeof args.arrival_date === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(args.arrival_date)
      ? args.arrival_date
      : undefined;
  const supabase = await createSupabaseServer();
  const scope = await placeInScope(supabase, planId, placeId);
  if (!scope.ok) return { success: false, message: scope.message };

  const patch: Record<string, unknown> = { zone };
  if (arrivalDate) patch.arrival_date = arrivalDate;
  const { error } = await supabase.from("places").update(patch).eq("id", placeId);
  if (error) {
    return { success: false, message: `Error assignant zona: ${error.message}` };
  }
  // El lloc pot ser d'un sub-plan/pare: revalida el seu propi plan.
  revalidatePath(`/plans/${scope.place.plan_id}`);
  return {
    success: true,
    message: `"${scope.place.name}" → zona "${zone}"${arrivalDate ? ` (${arrivalDate})` : ""}.`,
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
    case "update_plan_metadata":
      return executeUpdatePlanMetadata(planId, proposal.arguments);
    case "update_plan_body":
      return executeUpdatePlanBody(planId, proposal.arguments);
    case "delete_place":
      return executeDeletePlace(planId, proposal.arguments);
    case "update_checklist_item":
      return executeUpdateChecklistItem(planId, proposal.arguments);
    case "update_subplan_body":
      return withResolvedChild(planId, proposal, (childId) =>
        executeUpdatePlanBody(childId, proposal.arguments),
      );
    case "update_subplan_metadata":
      return withResolvedChild(planId, proposal, (childId) =>
        executeUpdatePlanMetadata(childId, proposal.arguments),
      );
    case "add_subplan_checklist_item":
      return withResolvedChild(planId, proposal, (childId) =>
        executeAddChecklistItem(childId, proposal.arguments),
      );
    case "update_subplan_checklist_item":
      return withResolvedChild(planId, proposal, (childId) =>
        executeUpdateChecklistItem(childId, proposal.arguments),
      );
    case "add_subplan_place":
      return withResolvedChild(planId, proposal, (childId) =>
        executeAddPlace(childId, proposal),
      );
    case "delete_subplan_place":
      return withResolvedChild(planId, proposal, (childId) =>
        executeDeletePlace(childId, proposal.arguments),
      );
    case "update_parent_body":
      return withResolvedParent(planId, (parentId) =>
        executeUpdatePlanBody(parentId, proposal.arguments),
      );
    case "update_parent_metadata":
      return withResolvedParent(planId, (parentId) =>
        executeUpdatePlanMetadata(parentId, proposal.arguments),
      );
    case "add_parent_checklist_item":
      return withResolvedParent(planId, (parentId) =>
        executeAddChecklistItem(parentId, proposal.arguments),
      );
    case "update_parent_checklist_item":
      return withResolvedParent(planId, (parentId) =>
        executeUpdateChecklistItem(parentId, proposal.arguments),
      );
    case "add_parent_place":
      return withResolvedParent(planId, (parentId) =>
        executeAddPlace(parentId, proposal),
      );
    case "delete_parent_place":
      return withResolvedParent(planId, (parentId) =>
        executeDeletePlace(parentId, proposal.arguments),
      );
    case "set_place_zone":
      return executeSetPlaceZone(planId, proposal.arguments);
    default:
      return { success: false, message: `Funció desconeguda: ${(proposal as { function_name: string }).function_name}` };
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
