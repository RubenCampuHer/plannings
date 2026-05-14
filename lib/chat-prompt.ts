// Builder pur del system instruction del copilot. NO és server action — pot
// fer-se servir des de qualsevol context (server action, script d'avaluació,
// tests). Tot el coneixement de com cridem la IA hauria de venir d'aquí.

import { formatDateRange } from "./format";
import { extractHeadings } from "./toc";

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

### 7. Quan no pots
- Edicions del plan ("afegeix Tokyo Tower"): respon que de moment només respons; per editar, "Editar" o Polish IA.
- Dades genuïnament absents: digues-ho i ofereix una aproximació o una acció ("afegir-ho al pressupost").

### 8. To
Català, càlid, personal, com un amic que ajuda a planificar. Sense corporativisme.`;
}
