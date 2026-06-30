// LLM-as-judge: una segona crida a Gemini que puntua la resposta del copilot
// contra una rúbrica. Output JSON estructurat per poder agregar scores.

import { GoogleGenAI, Type } from "@google/genai";
import type { EvalCase } from "./cases";

const JUDGE_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    scores: {
      type: Type.OBJECT,
      properties: {
        accuracy: { type: Type.NUMBER },
        calculation: { type: Type.NUMBER },
        cross_reference: { type: Type.NUMBER },
        specific_over_aggregate: { type: Type.NUMBER },
        section_linking: { type: Type.NUMBER },
        tone: { type: Type.NUMBER },
        brevity: { type: Type.NUMBER },
        overall: { type: Type.NUMBER },
      },
      required: [
        "accuracy",
        "calculation",
        "cross_reference",
        "specific_over_aggregate",
        "section_linking",
        "tone",
        "brevity",
        "overall",
      ],
    },
    strengths: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "Coses que la resposta fa BÉ (1-3 punts, frases curtes).",
    },
    issues: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description:
        "Problemes concrets: què falta, què està malament, què seria millor (1-5 punts).",
    },
    prompt_improvement_hint: {
      type: Type.STRING,
      description:
        "Suggeriment concret per millorar el SYSTEM PROMPT (no la resposta) si el judge veu un patró sistemàtic. Buit si la resposta és bona.",
    },
  },
  required: ["scores", "strengths", "issues", "prompt_improvement_hint"],
};

export type JudgeResult = {
  scores: {
    accuracy: number;
    calculation: number;
    cross_reference: number;
    specific_over_aggregate: number;
    section_linking: number;
    tone: number;
    brevity: number;
    overall: number;
  };
  strengths: string[];
  issues: string[];
  prompt_improvement_hint: string;
};

const JUDGE_SYSTEM = `Ets un avaluador exigent d'un assistent IA anomenat "copilot". Veuràs:
- El SYSTEM PROMPT que el copilot està utilitzant.
- El CONTEXT del pla (tot el que el copilot rep).
- La pregunta de l'usuari.
- La resposta del copilot.

Valoraràs la resposta de 0 a 10 a cada dimensió:

- **accuracy**: La resposta usa correctament la info del pla? 10 = tot exacte. 0 = inventa o ignora dades clau.
- **calculation**: Si la pregunta demana xifres/càlculs: mostra els components ("28 dies × 50€ = 1400€")? 10 = càlcul explícit i correcte. 0 = només dóna un nombre sense justificar, o no calcula.
- **cross_reference**: Si hi ha info redundant (agregat + específic), els confronta? 10 = sí, comenta discrepàncies. 5 = només una font. 0 = ignora l'altra font.
- **specific_over_aggregate**: Prioritza dades específiques (per país, per categoria) sobre globals? 10 = sempre. 0 = uniformement promedia el global.
- **section_linking**: Quan és útil enllaçar una secció, enllaça la H3 més específica? 10 = enllaç precís. 5 = enllaç a H2 quan hi havia H3 millor. 0 = no enllaça o inventa slug.
- **tone**: Català càlid, no corporatiu, no robòtic? 10 = perfecte.
- **brevity**: Llargada apropiada (1-4 paràgrafs)? 10 = just. 5 = una mica llarg. 0 = massa llarg/curt.
- **overall**: Score combinat (pondera segons el focus de la pregunta).

ÉS IMPORTANT que siguis estricte: si la resposta NO fa el càlcul que demana la pregunta, calculation ≤ 4. Si dóna un agregat dividit uniformement quan tenia dades específiques, specific_over_aggregate ≤ 3.

Output JSON exacte segons schema.`;

export async function judgeResponse(args: {
  client: GoogleGenAI;
  systemPrompt: string;
  question: string;
  response: string;
  evalCase: EvalCase;
}): Promise<JudgeResult> {
  const userMessage = `### MODE D'AQUEST CAS

${args.evalCase.mode === "conversa" ? "CONVERSA (només Q&A, el copilot NO té tools disponibles — no pot cridar funcions encara que volgués)" : "EDICIÓ (el copilot té tools per crear/editar/esborrar coses del plan actual i també dels seus SUB-PLANS via funcions *_subplan amb subplan_id)"}

### CONTEXT DEL COPILOT (el seu system prompt)

\`\`\`
${args.systemPrompt}
\`\`\`

### PREGUNTA DE L'USUARI

${args.question}

### RESPOSTA DEL COPILOT

${args.response}

### FOCUS D'AQUESTA AVALUACIÓ

${args.evalCase.focus.join(", ")}

### COMPORTAMENT IDEAL

${args.evalCase.ideal_behavior}

Avalua segons la rúbrica. Tingues en compte el MODE: a mode CONVERSA no pot cridar funcions; si l'usuari demana un canvi, hauria de redirigir-lo a Edició.`;

  const response = await args.client.models.generateContent({
    model: "gemini-2.5-pro",
    contents: [{ role: "user", parts: [{ text: userMessage }] }],
    config: {
      systemInstruction: JUDGE_SYSTEM,
      responseMimeType: "application/json",
      responseSchema: JUDGE_RESPONSE_SCHEMA,
      temperature: 0.2,
    },
  });

  const text = response.text;
  if (!text) throw new Error("Judge: resposta buida");
  return JSON.parse(text) as JudgeResult;
}
