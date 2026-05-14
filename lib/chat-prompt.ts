// Builder pur del system instruction del copilot. NO és server action — pot
// fer-se servir des de qualsevol context (server action, script d'avaluació,
// tests). Tot el coneixement de com cridem la IA hauria de venir d'aquí.

import { Type, type FunctionDeclaration } from "@google/genai";
import { formatDateRange } from "./format";
import { extractHeadings } from "./toc";

// =====================================================================
// Function calling (M8.2): el copilot proposa accions concretes que
// l'usuari ha de confirmar abans que s'apliquin.
// =====================================================================

export const COPILOT_FUNCTION_DECLARATIONS: FunctionDeclaration[] = [
  {
    name: "add_place",
    description:
      "Afegir un lloc al mapa del plan. El sistema farà geocoding via OpenStreetMap. Usa NOMÉS quan l'usuari demani EXPLÍCITAMENT afegir un lloc al mapa, no per a simples recomanacions.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        name: {
          type: Type.STRING,
          description: "Nom curt del lloc (ex. 'Cinema Verdi').",
        },
        search_query: {
          type: Type.STRING,
          description:
            "Query precisa per OpenStreetMap. Inclou ciutat o regió (ex. 'Cinema Verdi Barcelona', 'Tokyo Tower').",
        },
        why: {
          type: Type.STRING,
          description:
            "Per què val la pena (opcional, 1 frase curta — es guarda com a nota del lloc).",
        },
      },
      required: ["name", "search_query"],
    },
  },
  {
    name: "add_checklist_item",
    description:
      "Afegir un item a la checklist del plan. Usa NOMÉS quan l'usuari demani EXPLÍCITAMENT afegir-lo. Si l'usuari pregunta 'què em falta?' és Q&A, no afegeixis sense que ho demani.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        text: {
          type: Type.STRING,
          description:
            "Text curt de l'item, en català (ex. 'Comprar adaptadors universals').",
        },
      },
      required: ["text"],
    },
  },
  {
    name: "add_subplan",
    description:
      "Crear un sub-plan dins del plan actual. Usa NOMÉS quan l'usuari demani EXPLÍCITAMENT crear-ne un. El sub-plan tindrà els camps mínims; l'usuari el podrà completar després.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING, description: "Títol del sub-plan." },
        plan_type: {
          type: Type.STRING,
          enum: ["deep", "weekend", "day"],
          description:
            "Tipus: 'deep' (viatge llarg), 'weekend' (cap de setmana), 'day' (un dia).",
        },
        destination: {
          type: Type.STRING,
          description: "Destinació (opcional).",
        },
        summary: {
          type: Type.STRING,
          description: "Resum breu (1-2 frases) per a la targeta.",
        },
        start_date: {
          type: Type.STRING,
          description: "Data inici en format YYYY-MM-DD (opcional).",
        },
        end_date: {
          type: Type.STRING,
          description: "Data fi en format YYYY-MM-DD (opcional).",
        },
      },
      required: ["title", "plan_type", "summary"],
    },
  },
];

export type ProposalStatus = "pending" | "applied" | "cancelled" | "failed";

export type Proposal = {
  id: string;
  function_name: "add_place" | "add_checklist_item" | "add_subplan";
  arguments: Record<string, unknown>;
  status: ProposalStatus;
  /** Missatge curt amb què ha passat (resultat o error). */
  result_message?: string;
  /** Path opcional si el resultat porta a una nova entitat (ex. /plans/x). */
  result_path?: string;
  applied_at?: string;
};

const TYPE_LABELS: Record<string, string> = {
  deep: "viatge llarg",
  weekend: "cap de setmana",
  day: "dia",
};

function typeLabelOf(t: string): string {
  return TYPE_LABELS[t] ?? t;
}

export type CopilotPlanContext = {
  title: string;
  type: string;
  destination?: string;
  startDate?: string;
  endDate?: string;
  summary: string;
  body: string;
  places: Array<{ name: string; country?: string }>;
  checklist: Array<{ text: string; done: boolean }>;
  parent?: {
    id: string;
    title: string;
    type: string;
    destination?: string;
    startDate?: string;
    endDate?: string;
    summary: string;
  } | null;
  children: Array<{
    id: string;
    title: string;
    type: string;
    destination?: string;
    startDate?: string;
    endDate?: string;
    summary: string;
    /** Cos sencer del sub-pla. Si està disponible, el copilot pot raonar
     * amb el seu detall (preus per país, dies específics, etc.). */
    body?: string;
  }>;
};

export function buildCopilotSystemPrompt(ctx: CopilotPlanContext): string {
  const placesList =
    ctx.places.length > 0
      ? ctx.places
          .map((p) => `- ${p.name}${p.country ? ` (${p.country})` : ""}`)
          .join("\n")
      : "(cap)";

  const checklistList =
    ctx.checklist.length > 0
      ? ctx.checklist.map((c) => `- [${c.done ? "x" : " "}] ${c.text}`).join("\n")
      : "(cap)";

  const dateRange = formatDateRange(ctx.startDate, ctx.endDate);

  const parentBlock = ctx.parent
    ? `\nAquest pla forma part d'un viatge més gran:
- "${ctx.parent.title}" (${typeLabelOf(ctx.parent.type)}${
        ctx.parent.destination ? `, ${ctx.parent.destination}` : ""
      }${
        formatDateRange(ctx.parent.startDate, ctx.parent.endDate)
          ? `, ${formatDateRange(ctx.parent.startDate, ctx.parent.endDate)}`
          : ""
      }). Resum: ${ctx.parent.summary}. Enllaç: /plans/${ctx.parent.id}`
    : "";

  const childrenBlock =
    ctx.children.length > 0
      ? `\nSub-plans (peces d'aquest viatge) — has de fer servir el seu body sencer quan facis càlculs específics per país/regió:\n${ctx.children
          .map((c) => {
            const dr = formatDateRange(c.startDate, c.endDate);
            const header = `### Sub-plan: "${c.title}" (${typeLabelOf(c.type)}${
              c.destination ? `, ${c.destination}` : ""
            }${dr ? `, ${dr}` : ""}) — Enllaç: /plans/${c.id}\nResum: ${c.summary}`;
            return c.body
              ? `${header}\n\nCos del sub-plan:\n\`\`\`\n${c.body}\n\`\`\``
              : header;
          })
          .join("\n\n")}`
      : "";

  const headings = extractHeadings(ctx.body, [2, 3]);
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

  return `Ets el copilot del pla "${ctx.title}". Aquí tens tota la informació actual:

Tipus: ${typeLabelOf(ctx.type)}
Destinació: ${ctx.destination ?? "(sense definir)"}
Dates: ${dateRange ?? "(sense definir)"}
Resum: ${ctx.summary}
${parentBlock}${childrenBlock}

Llocs al mapa:
${placesList}

Checklist:
${checklistList}
${headingsBlock}

Cos del pla (Markdown, pot incloure imatges \`![](pp:...)\`):
\`\`\`
${ctx.body}
\`\`\`

## REGLES PRINCIPALS (per ordre d'importància)

### 1. MOSTRA SEMPRE EL CÀLCUL
Si la resposta involucra un nombre, has de mostrar D'ON SURT — fins i tot per a càlculs simples.

✅ Bé: "Vietnam: del 12-feb al 8-mar = **25 dies**. Tailàndia: del 9 al 31-mar = **23 dies**."
❌ Malament: "Vietnam: 25 dies. Tailàndia: 23 dies."

✅ Bé: "Indonèsia (1-28 gener = 28 dies) × 25-40€/persona/dia × 2 persones = **1400-2240€ base**. El sub-plan dona 2040-3420€ → la diferència són tours (Bromo, Komodo)."
❌ Malament: "Indonèsia: 2040-3420€."

**Dates > durada arrodonida**: si tens DATES exactes I durada en setmanes, calcula des de les dates. P.ex. "Vietnam (3 setmanes)" amb dates 12-feb a 8-mar són **25 dies**, NO 21. La durada al títol és arrodonida; les dates manen.

### 2. EXPLOTA EL BODY DELS SUB-PLANS
Els sub-plans tenen el seu propi body amb dades específiques (costos diaris, dies, llocs, etc.). Sempre que la pregunta sigui sobre un país/regió, busca al sub-plan corresponent ABANS de mirar el pla pare.

PRIORITAT: dada del sub-plan > dada del pare > estimació qualitativa.

### 3. RAONA QUALITATIVAMENT si no hi ha xifres
Si no hi ha numèrics exactes, NO et rendeixis amb "no consta". Usa:
- Durada relativa ("4 setmanes vs 3" → ~33% més temps).
- Pistes del body ("ha pujat de preu", "el més assequible").
- Coneixement general (Indonèsia/Cambodja són notòriament més assequibles que Tailàndia).

Sempre digues que és raonament qualitatiu i quines pistes uses.

### 4. CROSS-REFERENCE entre agregat i específic
Si tens una xifra agregada (Àsia: 5000-6500€) I dades per país (Indonèsia: 2040-3420€, Cambodja: 885-1445€...), suma els específics i comenta si quadren amb l'agregat o no.

### 5. BREVETAT segons tipus de pregunta
- **Càlcul/comparació**: 2-4 paràgrafs amb números i justificació.
- **Navegacional** ("on parla de X?"): 1-2 frases + 1-3 enllaços, MAI repeteixis el contingut del body — l'usuari hi pot anar.
- **Recomanació**: 2-4 paràgrafs amb 2-3 opcions concretes.

Mai més de 4 paràgrafs en total.

### 6. ENLLAÇOS — sintaxi estricta
- Secció del PLA ACTUAL: \`[nom](#slug)\` — només slugs de la llista "Seccions del cos del plan".
- Prefereix H3 sobre H2 si l'H3 cobreix millor el tema.
- Sub-plan: \`[títol](/plans/slug)\` SENSE #ancora. Encara que vegis headings dins del body del sub-plan, NO els enllacis com a #ancora — els slugs interns dels sub-plans NO estan al teu context.
- Pla pare: \`[títol](/plans/slug-del-pare)\` sense ancora.
- NO inventis slugs. NO posis cap enllaç forçat si no és rellevant.

### 7. FUNCIONS (pots proposar canvis al plan)
Tens 3 funcions disponibles per proposar modificacions:
- \`add_place(name, search_query, why?)\` — afegir un lloc al mapa
- \`add_checklist_item(text)\` — afegir un item a la checklist
- \`add_subplan(title, plan_type, summary, destination?, start_date?, end_date?)\` — crear un sub-plan

**REGLA CLAU**: distingeix VERB IMPERATIU vs PREGUNTA. Només crida una funció si l'usuari et dóna una ORDRE explícita ("afegeix...", "posa...", "crea..."). Per a tota la resta, responsen TEXT.

✅ Crida funció:
- "Afegeix Cinema Verdi al mapa" → \`add_place\`
- "Posa 'Comprar adaptador' a la checklist" → \`add_checklist_item\`
- "Crea un sub-plan per Bali" → \`add_subplan\`

❌ NO crides funció (només text):
- "Què em recomanaries afegir a la checklist?" → text amb suggeriments + acaba amb "Vols que t'afegeixi algun?"
- "Què em fa falta?" → text llistant items que falten
- "Quins llocs valdrien la pena a Bangkok?" → recomanacions en text
- "Com seria un sub-plan d'Itàlia?" → descripció en text
- "Què passaria si..." → especulació en text

Quan cridis una funció, escriu també un MISSATGE BREU confirmant la proposta ("D'acord, et proposo afegir-lo."). L'usuari haurà de confirmar abans que s'apliqui.

Si l'usuari demana afegir múltiples coses en una sola ordre ("afegeix X, Y i Z"), pots cridar múltiples funcions a la mateixa resposta.

### 8. Quan no pots
- Si l'usuari demana modificar coses fora d'aquestes 3 funcions (canviar el body, esborrar coses, editar dates), digues-li que això encara no està disponible i li recomanes anar a "Editar".
- Dades genuïnament absents: digues-ho i ofereix una aproximació o una acció.

### 9. To
Català, càlid, personal, com un amic que ajuda a planificar. Sense corporativisme.`;
}
