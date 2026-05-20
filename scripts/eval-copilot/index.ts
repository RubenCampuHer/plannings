// Agent intern d'avaluació del copilot.
//
// Què fa:
// 1. Connecta a Supabase amb service role (necessita SUPABASE_SERVICE_ROLE_KEY)
//    per llegir qualsevol plan saltant-se les RLS.
// 2. Carrega un pla (per id passat com a argument, o el més recent amb body
//    més llarg que un mínim).
// 3. Construeix el mateix system prompt que el server action usaria.
// 4. Per cada cas de test: envia la pregunta a Gemini Flash i obté la
//    resposta del "copilot".
// 5. Un judge (Gemini Pro) puntua la resposta contra una rúbrica.
// 6. Genera un report Markdown a stdout + el desa a un fitxer datat.
//
// Ús:
//   tsx scripts/eval-copilot/index.ts                 # plan triat auto
//   tsx scripts/eval-copilot/index.ts plan-id-aqui    # plan concret
//   tsx scripts/eval-copilot/index.ts --list          # llista plans

import { GoogleGenAI } from "@google/genai";
import { createClient } from "@supabase/supabase-js";
import { config as loadDotenv } from "dotenv";
import fs from "node:fs";
import path from "node:path";
import WebSocket from "ws";

import {
  buildCopilotSystemPrompt,
  COPILOT_FUNCTION_DECLARATIONS,
  type ChatMode,
} from "../../lib/chat-prompt";
import { CASES, type EvalCase } from "./cases";
import { judgeResponse, type JudgeResult } from "./judge";

loadDotenv({ path: ".env.local" });

// Node 20 no té WebSocket natiu i el client de Supabase l'inicialitza encara
// que no l'usem (per al realtime). Polyfill global suficient per al script.
if (typeof globalThis.WebSocket === "undefined") {
  // @ts-expect-error — ws no és 100% API-compatible però fa la feina per init.
  globalThis.WebSocket = WebSocket;
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const GOOGLE_AI_KEY = process.env.GOOGLE_AI_API_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE) {
  console.error(
    "❌ Falten env vars. Necessites NEXT_PUBLIC_SUPABASE_URL i SUPABASE_SERVICE_ROLE_KEY a .env.local.",
  );
  console.error(
    "   La service role key és a Supabase Dashboard → Settings → API → 'service_role' (no la pugis al repo).",
  );
  process.exit(1);
}
if (!GOOGLE_AI_KEY) {
  console.error("❌ Falta GOOGLE_AI_API_KEY a .env.local.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const ai = new GoogleGenAI({ apiKey: GOOGLE_AI_KEY });

type PlanRow = {
  id: string;
  title: string;
  type: string;
  status: string;
  destination: string | null;
  start_date: string | null;
  end_date: string | null;
  summary: string;
  body: string;
  parent_plan_id: string | null;
};

async function listPlans(): Promise<void> {
  const { data, error } = await supabase
    .from("plans")
    .select("id,title,type,destination,parent_plan_id")
    .order("updated_at", { ascending: false });
  if (error) {
    console.error("Error llegint plans:", error.message);
    process.exit(1);
  }
  console.log(`\nPlans disponibles (${data?.length ?? 0}):\n`);
  for (const p of data ?? []) {
    const sub = p.parent_plan_id ? "(sub-plan) " : "";
    console.log(
      `  ${sub}${p.id}  —  ${p.title}  [${p.type}${p.destination ? `, ${p.destination}` : ""}]`,
    );
  }
}

async function pickBestPlan(): Promise<PlanRow | null> {
  // Volem un pla top-level amb body llarg perquè els tests tinguin substància.
  const { data, error } = await supabase
    .from("plans")
    .select("id,title,type,status,destination,start_date,end_date,summary,body,parent_plan_id")
    .is("parent_plan_id", null)
    .neq("status", "archived")
    .order("updated_at", { ascending: false });
  if (error || !data) return null;

  const sorted = (data as PlanRow[])
    .filter((p) => p.body && p.body.length > 500)
    .sort((a, b) => b.body.length - a.body.length);
  return sorted[0] ?? (data as PlanRow[])[0] ?? null;
}

async function loadPlan(planId: string): Promise<PlanRow | null> {
  const { data, error } = await supabase
    .from("plans")
    .select("id,title,type,status,destination,start_date,end_date,summary,body,parent_plan_id")
    .eq("id", planId)
    .maybeSingle();
  if (error || !data) return null;
  return data as PlanRow;
}

async function loadContext(plan: PlanRow) {
  const [parentRes, childrenRes, placesRes, checklistRes] = await Promise.all([
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
      .eq("parent_plan_id", plan.id)
      .order("start_date", { ascending: true, nullsFirst: false }),
    supabase.from("places").select("id,name,country").eq("plan_id", plan.id).order("order_index"),
    supabase.from("checklist_items").select("id,text,done").eq("plan_id", plan.id),
  ]);

  return {
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
  };
}

type CopilotReply = {
  text: string;
  functionCalls: Array<{ name: string; args: Record<string, unknown> }>;
};

async function askCopilot(
  systemPrompt: string,
  question: string,
  mode: ChatMode,
): Promise<CopilotReply> {
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [{ role: "user", parts: [{ text: question }] }],
    config: {
      systemInstruction: systemPrompt,
      // Mantenim 0.6 alineat amb chat-actions.ts.
      temperature: 0.6,
      // Tools només a mode edició — mateix flow que el server action.
      tools:
        mode === "edicio"
          ? [{ functionDeclarations: COPILOT_FUNCTION_DECLARATIONS }]
          : undefined,
    },
  });

  const parts = response.candidates?.[0]?.content?.parts ?? [];
  let text = "";
  const functionCalls: CopilotReply["functionCalls"] = [];
  for (const p of parts) {
    if (typeof p.text === "string") text += p.text;
    if (p.functionCall) {
      functionCalls.push({
        name: p.functionCall.name ?? "?",
        args: (p.functionCall.args ?? {}) as Record<string, unknown>,
      });
    }
  }
  return { text, functionCalls };
}

type CaseRun = {
  evalCase: EvalCase;
  response: string;
  functionCalls: CopilotReply["functionCalls"];
  judge: JudgeResult;
  error?: string;
};

function fmt(n: number): string {
  return n.toFixed(1).padStart(4, " ");
}

function buildReport(plan: PlanRow, runs: CaseRun[]): string {
  const ok = runs.filter((r) => !r.error);
  const avg = (key: keyof JudgeResult["scores"]) =>
    ok.length === 0
      ? 0
      : ok.reduce((s, r) => s + r.judge.scores[key], 0) / ok.length;

  const lines: string[] = [];
  lines.push(`# Eval Copilot — ${new Date().toISOString()}\n`);
  lines.push(`**Plan**: \`${plan.id}\` — *${plan.title}*  `);
  lines.push(
    `**Body**: ${plan.body.length} chars · **Casos**: ${runs.length} (${ok.length} OK)\n`,
  );

  lines.push("## Scores agregats\n");
  lines.push("| Dimensió | Mitjana (0-10) |");
  lines.push("|---|---|");
  lines.push(`| accuracy | ${fmt(avg("accuracy"))} |`);
  lines.push(`| calculation | ${fmt(avg("calculation"))} |`);
  lines.push(`| cross_reference | ${fmt(avg("cross_reference"))} |`);
  lines.push(`| specific_over_aggregate | ${fmt(avg("specific_over_aggregate"))} |`);
  lines.push(`| section_linking | ${fmt(avg("section_linking"))} |`);
  lines.push(`| tone | ${fmt(avg("tone"))} |`);
  lines.push(`| brevity | ${fmt(avg("brevity"))} |`);
  lines.push(`| **overall** | **${fmt(avg("overall"))}** |\n`);

  lines.push("## Per cas\n");
  for (const r of runs) {
    lines.push(`### ${r.evalCase.id} — overall: ${r.error ? "ERROR" : fmt(r.judge.scores.overall)}\n`);
    lines.push(`**Pregunta**: ${r.evalCase.question}\n`);
    lines.push(`**Focus**: ${r.evalCase.focus.join(", ")}\n`);
    if (r.error) {
      lines.push(`**Error**: ${r.error}\n`);
      continue;
    }
    lines.push(`<details><summary>Resposta del copilot</summary>\n\n${r.response}\n\n</details>\n`);
    if (r.functionCalls.length > 0) {
      lines.push(`**🛠 Function calls**:`);
      for (const fc of r.functionCalls) {
        lines.push(`- \`${fc.name}(${JSON.stringify(fc.args)})\``);
      }
      lines.push("");
    }
    lines.push(`**Scores**: acc ${fmt(r.judge.scores.accuracy)} · calc ${fmt(r.judge.scores.calculation)} · cross ${fmt(r.judge.scores.cross_reference)} · spec ${fmt(r.judge.scores.specific_over_aggregate)} · link ${fmt(r.judge.scores.section_linking)} · tone ${fmt(r.judge.scores.tone)} · brev ${fmt(r.judge.scores.brevity)}\n`);
    if (r.judge.strengths.length > 0) {
      lines.push(`**✅ Fa bé**:`);
      for (const s of r.judge.strengths) lines.push(`- ${s}`);
      lines.push("");
    }
    if (r.judge.issues.length > 0) {
      lines.push(`**⚠️ Problemes**:`);
      for (const i of r.judge.issues) lines.push(`- ${i}`);
      lines.push("");
    }
    if (r.judge.prompt_improvement_hint.trim()) {
      lines.push(`**💡 Hint per al prompt**: ${r.judge.prompt_improvement_hint}\n`);
    }
  }

  lines.push("## Patrons al prompt (resum dels hints)\n");
  const hints = ok
    .map((r) => r.judge.prompt_improvement_hint.trim())
    .filter((h) => h.length > 0);
  if (hints.length === 0) {
    lines.push("_(cap suggeriment)_");
  } else {
    for (const h of hints) lines.push(`- ${h}`);
  }

  return lines.join("\n");
}

async function main() {
  const arg = process.argv[2];
  if (arg === "--list") {
    await listPlans();
    return;
  }

  const plan = arg ? await loadPlan(arg) : await pickBestPlan();
  if (!plan) {
    console.error("❌ No s'ha trobat el pla.");
    process.exit(1);
  }

  console.log(`🧪 Avaluant copilot amb el pla: ${plan.id} — ${plan.title}`);
  console.log(`   Body: ${plan.body.length} chars · ${CASES.length} casos\n`);

  const ctx = await loadContext(plan);

  const runs: CaseRun[] = [];
  for (const c of CASES) {
    process.stdout.write(`  · [${c.mode}] ${c.id} … `);
    try {
      // Build prompt per cas perquè canvia segons mode.
      const systemPrompt = buildCopilotSystemPrompt(ctx, c.mode);
      const reply = await askCopilot(systemPrompt, c.question, c.mode);
      if (!reply.text.trim() && reply.functionCalls.length === 0) {
        throw new Error("resposta buida del copilot");
      }
      const fcText =
        reply.functionCalls.length > 0
          ? `\n\n[function calls: ${reply.functionCalls
              .map((fc) => `${fc.name}(${JSON.stringify(fc.args)})`)
              .join(", ")}]`
          : "";
      const judge = await judgeResponse({
        client: ai,
        systemPrompt,
        question: c.question,
        response: reply.text + fcText,
        evalCase: c,
      });
      runs.push({
        evalCase: c,
        response: reply.text,
        functionCalls: reply.functionCalls,
        judge,
      });
      console.log(`overall ${judge.scores.overall}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      runs.push({
        evalCase: c,
        response: "",
        functionCalls: [],
        judge: null as unknown as JudgeResult,
        error: msg,
      });
      console.log(`ERROR ${msg}`);
    }
  }

  const report = buildReport(plan, runs);
  const outDir = path.join("scripts", "eval-copilot", "reports");
  fs.mkdirSync(outDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outFile = path.join(outDir, `${stamp}__${plan.id}.md`);
  fs.writeFileSync(outFile, report, "utf-8");

  console.log(`\n📊 Report a: ${outFile}\n`);
  console.log(report);
}

main().catch((e) => {
  console.error("Fallada:", e);
  process.exit(1);
});
