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
      ? `\nSub-plans (peces d'aquest viatge):\n${ctx.children
          .map((c) => {
            const dr = formatDateRange(c.startDate, c.endDate);
            return `- "${c.title}" (${typeLabelOf(c.type)}${
              c.destination ? `, ${c.destination}` : ""
            }${dr ? `, ${dr}` : ""}): ${c.summary}. Enllaç: /plans/${c.id}`;
          })
          .join("\n")}`
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
}
