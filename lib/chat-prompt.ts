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
        arrival_date: {
          type: Type.STRING,
          description:
            "Data de visita en format YYYY-MM-DD (opcional). Posa-la si l'usuari indica quan visita el lloc — alimenta l'itinerari per dia.",
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
  {
    name: "update_plan_metadata",
    description:
      "Edita un o més camps de metadades del plan actual (títol, resum, destinació, dates). Almenys un camp ha de ser present. Usa NOMÉS quan l'usuari demani EXPLÍCITAMENT canviar-ho ('canvia el títol', 'actualitza el resum', 'la destinació ja no és X sinó Y').",
    parameters: {
      type: Type.OBJECT,
      properties: {
        title: {
          type: Type.STRING,
          description: "Nou títol del plan (opcional).",
        },
        summary: {
          type: Type.STRING,
          description: "Nou resum (1-2 frases) del plan (opcional).",
        },
        destination: {
          type: Type.STRING,
          description:
            "Nova destinació. Per esborrar-la, posa una cadena buida (opcional).",
        },
        start_date: {
          type: Type.STRING,
          description: "Nova data d'inici YYYY-MM-DD (opcional).",
        },
        end_date: {
          type: Type.STRING,
          description: "Nova data de fi YYYY-MM-DD (opcional).",
        },
      },
    },
  },
  {
    name: "update_plan_body",
    description:
      "Substitueix el cos sencer del plan actual amb un nou Markdown. Usa quan l'usuari demani reescriure el cos, eliminar seccions, o fer canvis substancials a múltiples llocs del body. CRÍTIC: has de retornar el body COMPLET, no només la part nova ni un diff. PRESERVA totes les imatges inline `![](pp:...)` que ja hi havia, excepte si l'usuari demana explícitament treure-les.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        new_body: {
          type: Type.STRING,
          description:
            "El nou cos Markdown sencer. Incloure tots els headings, paràgrafs i imatges inline `![](pp:...)` que han de quedar.",
        },
        summary: {
          type: Type.STRING,
          description:
            "Resum nou (1-2 frases) per a l'índex/entradilla. Inclou-lo SEMPRE QUE PUGUIS quan el canvi de body sigui substancial i el resum actual hagi quedat desfasat (opcional).",
        },
      },
      required: ["new_body"],
    },
  },
  {
    name: "delete_place",
    description:
      "Esborra un lloc del mapa pel seu id. Els ids els tens a la llista 'Llocs al mapa' del context. Usa NOMÉS quan l'usuari demani EXPLÍCITAMENT treure un lloc ('treu Sydney del mapa', 'esborra el Great Barrier Reef').",
    parameters: {
      type: Type.OBJECT,
      properties: {
        place_id: {
          type: Type.STRING,
          description: "ID del lloc tal com apareix al context.",
        },
      },
      required: ["place_id"],
    },
  },
  {
    name: "update_checklist_item",
    description:
      "Edita el text o l'estat d'un ítem de la checklist pel seu id. Els ids els tens a la llista 'Checklist' del context. Almenys un de text/done s'ha de proporcionar.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        item_id: {
          type: Type.STRING,
          description: "ID de l'ítem tal com apareix al context.",
        },
        text: {
          type: Type.STRING,
          description: "Nou text de l'ítem (opcional).",
        },
        done: {
          type: Type.BOOLEAN,
          description:
            "Marcar com a fet (true) o desmarcar (false) (opcional).",
        },
      },
      required: ["item_id"],
    },
  },
  // ===================================================================
  // Edició de SUB-PLANS (fills directes del plan actual). Totes reben el
  // `subplan_id` tal com apareix al context (secció "Sub-plans"). El
  // sistema valida que el sub-plan és fill abans d'aplicar res.
  // ===================================================================
  {
    name: "update_subplan_body",
    description:
      "Substitueix el cos sencer d'un SUB-PLAN (fill del plan actual) amb un nou Markdown. CRÍTIC: retorna el body COMPLET, no un diff. PRESERVA les imatges inline `![](pp:...)` del sub-plan. Usa el `subplan_id` de la secció 'Sub-plans' del context.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        subplan_id: {
          type: Type.STRING,
          description: "ID del sub-plan tal com apareix al context.",
        },
        new_body: {
          type: Type.STRING,
          description:
            "El nou cos Markdown sencer del sub-plan, amb tots els headings, paràgrafs i imatges inline que han de quedar.",
        },
        summary: {
          type: Type.STRING,
          description:
            "Resum nou (1-2 frases) per a l'índex/entradilla del sub-plan. Inclou-lo SEMPRE QUE PUGUIS quan el canvi sigui substancial i el resum actual hagi quedat desfasat (opcional).",
        },
      },
      required: ["subplan_id", "new_body"],
    },
  },
  {
    name: "update_subplan_metadata",
    description:
      "Edita un o més camps de metadades d'un SUB-PLAN (títol, resum, destinació, dates). Almenys un camp ha de ser present. Usa el `subplan_id` de la secció 'Sub-plans' del context.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        subplan_id: {
          type: Type.STRING,
          description: "ID del sub-plan tal com apareix al context.",
        },
        title: { type: Type.STRING, description: "Nou títol (opcional)." },
        summary: {
          type: Type.STRING,
          description: "Nou resum (1-2 frases) (opcional).",
        },
        destination: {
          type: Type.STRING,
          description:
            "Nova destinació. Per esborrar-la, posa una cadena buida (opcional).",
        },
        start_date: {
          type: Type.STRING,
          description: "Nova data d'inici YYYY-MM-DD (opcional).",
        },
        end_date: {
          type: Type.STRING,
          description: "Nova data de fi YYYY-MM-DD (opcional).",
        },
      },
      required: ["subplan_id"],
    },
  },
  {
    name: "add_subplan_checklist_item",
    description:
      "Afegir un item a la checklist d'un SUB-PLAN. Usa NOMÉS quan l'usuari ho demani explícitament. Usa el `subplan_id` de la secció 'Sub-plans'.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        subplan_id: {
          type: Type.STRING,
          description: "ID del sub-plan tal com apareix al context.",
        },
        text: {
          type: Type.STRING,
          description: "Text curt de l'item, en català.",
        },
      },
      required: ["subplan_id", "text"],
    },
  },
  {
    name: "update_subplan_checklist_item",
    description:
      "Edita el text o l'estat d'un ítem de la checklist d'un SUB-PLAN. Almenys un de text/done. Els ids d'ítem els tens sota cada sub-plan al context.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        subplan_id: {
          type: Type.STRING,
          description: "ID del sub-plan tal com apareix al context.",
        },
        item_id: {
          type: Type.STRING,
          description: "ID de l'ítem de checklist tal com apareix al context.",
        },
        text: {
          type: Type.STRING,
          description: "Nou text de l'ítem (opcional).",
        },
        done: {
          type: Type.BOOLEAN,
          description: "Marcar com a fet (true) o desmarcar (false) (opcional).",
        },
      },
      required: ["subplan_id", "item_id"],
    },
  },
  {
    name: "add_subplan_place",
    description:
      "Afegir un lloc al mapa d'un SUB-PLAN. El sistema farà geocoding via OpenStreetMap. Usa el `subplan_id` de la secció 'Sub-plans'.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        subplan_id: {
          type: Type.STRING,
          description: "ID del sub-plan tal com apareix al context.",
        },
        name: {
          type: Type.STRING,
          description: "Nom curt del lloc (ex. 'Cinema Verdi').",
        },
        search_query: {
          type: Type.STRING,
          description:
            "Query precisa per OpenStreetMap. Inclou ciutat o regió.",
        },
        why: {
          type: Type.STRING,
          description:
            "Per què val la pena (opcional, 1 frase — es guarda com a nota).",
        },
        arrival_date: {
          type: Type.STRING,
          description:
            "Data de visita en format YYYY-MM-DD (opcional) per a l'itinerari del sub-plan.",
        },
      },
      required: ["subplan_id", "name", "search_query"],
    },
  },
  {
    name: "delete_subplan_place",
    description:
      "Esborra un lloc del mapa d'un SUB-PLAN pel seu id. Els ids els tens sota cada sub-plan al context. Usa NOMÉS quan l'usuari ho demani explícitament.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        subplan_id: {
          type: Type.STRING,
          description: "ID del sub-plan tal com apareix al context.",
        },
        place_id: {
          type: Type.STRING,
          description: "ID del lloc tal com apareix al context.",
        },
      },
      required: ["subplan_id", "place_id"],
    },
  },
  // ===================================================================
  // Edició del PLA PARE (si el pla actual en té un). No porten id: el pare
  // és únic. El sistema valida que el pla actual té pare abans d'aplicar.
  // ===================================================================
  {
    name: "update_parent_body",
    description:
      "Substitueix el cos sencer del PLA PARE amb un nou Markdown. CRÍTIC: retorna el body COMPLET, no un diff. PRESERVA les imatges inline `![](pp:...)`. Usa NOMÉS si el pla actual té pare (secció 'Aquest pla forma part d'un viatge més gran').",
    parameters: {
      type: Type.OBJECT,
      properties: {
        new_body: {
          type: Type.STRING,
          description: "El nou cos Markdown sencer del pla pare.",
        },
        summary: {
          type: Type.STRING,
          description:
            "Resum nou (1-2 frases) per a l'índex del pare. Inclou-lo si el canvi és substancial (opcional).",
        },
      },
      required: ["new_body"],
    },
  },
  {
    name: "update_parent_metadata",
    description:
      "Edita un o més camps de metadades del PLA PARE (títol, resum, destinació, dates). Almenys un camp.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING, description: "Nou títol (opcional)." },
        summary: { type: Type.STRING, description: "Nou resum (opcional)." },
        destination: {
          type: Type.STRING,
          description: "Nova destinació; cadena buida per esborrar (opcional).",
        },
        start_date: {
          type: Type.STRING,
          description: "Nova data d'inici YYYY-MM-DD (opcional).",
        },
        end_date: {
          type: Type.STRING,
          description: "Nova data de fi YYYY-MM-DD (opcional).",
        },
      },
    },
  },
  {
    name: "add_parent_checklist_item",
    description:
      "Afegir un item a la checklist del PLA PARE. Usa NOMÉS quan l'usuari ho demani explícitament.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        text: { type: Type.STRING, description: "Text curt de l'item, en català." },
      },
      required: ["text"],
    },
  },
  {
    name: "update_parent_checklist_item",
    description:
      "Edita el text o l'estat d'un ítem de la checklist del PLA PARE. Almenys un de text/done. Els ids els tens a la secció del pare.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        item_id: {
          type: Type.STRING,
          description: "ID de l'ítem de checklist del pare tal com apareix al context.",
        },
        text: { type: Type.STRING, description: "Nou text (opcional)." },
        done: { type: Type.BOOLEAN, description: "Marcar/desmarcar (opcional)." },
      },
      required: ["item_id"],
    },
  },
  {
    name: "add_parent_place",
    description:
      "Afegir un lloc al mapa del PLA PARE. El sistema farà geocoding via OpenStreetMap.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        name: { type: Type.STRING, description: "Nom curt del lloc." },
        search_query: {
          type: Type.STRING,
          description: "Query precisa per OpenStreetMap. Inclou ciutat o regió.",
        },
        why: { type: Type.STRING, description: "Per què (opcional, nota)." },
        arrival_date: {
          type: Type.STRING,
          description: "Data YYYY-MM-DD (opcional).",
        },
      },
      required: ["name", "search_query"],
    },
  },
  {
    name: "delete_parent_place",
    description:
      "Esborra un lloc del mapa del PLA PARE pel seu id. Els ids els tens a la secció del pare.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        place_id: {
          type: Type.STRING,
          description: "ID del lloc del pare tal com apareix al context.",
        },
      },
      required: ["place_id"],
    },
  },
];

export type ProposalStatus = "pending" | "applied" | "cancelled" | "failed";

export type ProposalFunctionName =
  | "add_place"
  | "add_checklist_item"
  | "add_subplan"
  | "update_plan_metadata"
  | "update_plan_body"
  | "delete_place"
  | "update_checklist_item"
  | "update_subplan_body"
  | "update_subplan_metadata"
  | "add_subplan_checklist_item"
  | "update_subplan_checklist_item"
  | "add_subplan_place"
  | "delete_subplan_place"
  | "update_parent_body"
  | "update_parent_metadata"
  | "add_parent_checklist_item"
  | "update_parent_checklist_item"
  | "add_parent_place"
  | "delete_parent_place";

/** Conjunt de noms de funcions que operen sobre un sub-plan (porten subplan_id). */
export const SUBPLAN_FUNCTION_NAMES: ReadonlySet<ProposalFunctionName> = new Set([
  "update_subplan_body",
  "update_subplan_metadata",
  "add_subplan_checklist_item",
  "update_subplan_checklist_item",
  "add_subplan_place",
  "delete_subplan_place",
]);

/** Conjunt de noms de funcions que operen sobre el pla pare. */
export const PARENT_FUNCTION_NAMES: ReadonlySet<ProposalFunctionName> = new Set([
  "update_parent_body",
  "update_parent_metadata",
  "add_parent_checklist_item",
  "update_parent_checklist_item",
  "add_parent_place",
  "delete_parent_place",
]);

export type Proposal = {
  id: string;
  function_name: ProposalFunctionName;
  arguments: Record<string, unknown>;
  status: ProposalStatus;
  /** Missatge curt amb què ha passat (resultat o error). */
  result_message?: string;
  /** Path opcional si el resultat porta a una nova entitat (ex. /plans/x). */
  result_path?: string;
  applied_at?: string;
  /** Preview pre-resolt amb dades capturades en el moment de la proposta —
   *  geocoding per a add_place, "abans" per a updates/deletes — perquè
   *  l'usuari sàpiga exactament què s'aplicarà i, en cas d'updates, què
   *  canvia respecte a l'estat actual. */
  preview?: {
    /** Variants *_subplan: quin sub-plan és el target (per etiquetar la card). */
    subplan?: {
      id: string;
      title: string;
    };
    /** Variants *_parent: el pla pare target (per etiquetar la card). */
    parent?: {
      id: string;
      title: string;
    };
    /** add_place: ubicació geocodificada. */
    geocoded?: {
      name: string;
      country: string | null;
      lat: number;
      lng: number;
      displayName: string;
    };
    /** delete_place: snapshot del lloc abans d'esborrar-lo. */
    place_before?: {
      name: string;
      country?: string;
    };
    /** update_checklist_item: text/done previs per fer diff. */
    item_before?: {
      text: string;
      done: boolean;
    };
    /** update_plan_metadata: valors previs dels camps que canvien. */
    metadata_before?: {
      title?: string;
      summary?: string;
      destination?: string;
      start_date?: string;
      end_date?: string;
    };
    /** update_plan_body: caràcters / línies del cos actual i del proposat,
     *  per mostrar la magnitud del canvi a la card. */
    body_stats?: {
      before_chars: number;
      before_lines: number;
      after_chars: number;
      after_lines: number;
    };
  };
};

export type ChatMode = "conversa" | "edicio";

const TYPE_LABELS: Record<string, string> = {
  deep: "viatge llarg",
  weekend: "cap de setmana",
  day: "dia",
};

function typeLabelOf(t: string): string {
  return TYPE_LABELS[t] ?? t;
}

/** Un pla (pare, fill o net) amb el seu contingut editable pel copilot. */
export type PlanNode = {
  id: string;
  title: string;
  type: string;
  destination?: string;
  startDate?: string;
  endDate?: string;
  summary: string;
  /** Cos sencer. El copilot pot raonar amb el detall (preus, dies, etc.). */
  body?: string;
  /** Checklist amb ids — perquè el copilot pugui editar ítems. */
  checklist?: Array<{ id: string; text: string; done: boolean }>;
  /** Llocs amb ids — perquè el copilot pugui editar/esborrar-los. */
  places?: Array<{ id: string; name: string; country?: string }>;
};

export type CopilotPlanContext = {
  title: string;
  type: string;
  destination?: string;
  startDate?: string;
  endDate?: string;
  summary: string;
  body: string;
  places: Array<{ id: string; name: string; country?: string }>;
  checklist: Array<{ id: string; text: string; done: boolean }>;
  /** Pla pare amb contingut: el copilot pot editar-lo amb les funcions *_parent. */
  parent?: PlanNode | null;
  /** Sub-plans (fills directes), cadascun amb els seus nets (grandchildren). */
  children: Array<PlanNode & { children?: PlanNode[] }>;
};

export function buildCopilotSystemPrompt(
  ctx: CopilotPlanContext,
  mode: ChatMode = "edicio",
): string {
  const placesList =
    ctx.places.length > 0
      ? ctx.places
          .map(
            (p) =>
              `- id=${p.id} · ${p.name}${p.country ? ` (${p.country})` : ""}`,
          )
          .join("\n")
      : "(cap)";

  const checklistList =
    ctx.checklist.length > 0
      ? ctx.checklist
          .map(
            (c) => `- [${c.done ? "x" : " "}] id=${c.id} · ${c.text}`,
          )
          .join("\n")
      : "(cap)";

  const dateRange = formatDateRange(ctx.startDate, ctx.endDate);

  // Renderitza checklist + llocs (amb ids) + cos d'un node (pare/fill/net).
  const renderNodeContent = (n: PlanNode, indent: string): string => {
    const cl =
      n.checklist && n.checklist.length > 0
        ? `\n${indent}Checklist:\n${n.checklist
            .map((i) => `${indent}  - [${i.done ? "x" : " "}] item_id=${i.id} · ${i.text}`)
            .join("\n")}`
        : "";
    const pl =
      n.places && n.places.length > 0
        ? `\n${indent}Llocs al mapa:\n${n.places
            .map((p) => `${indent}  - place_id=${p.id} · ${p.name}${p.country ? ` (${p.country})` : ""}`)
            .join("\n")}`
        : "";
    const body = n.body ? `\n\nCos:\n\`\`\`\n${n.body}\n\`\`\`` : "";
    return `${cl}${pl}${body}`;
  };

  const nodeHeader = (n: PlanNode): string => {
    const dr = formatDateRange(n.startDate, n.endDate);
    return `"${n.title}" (${typeLabelOf(n.type)}${
      n.destination ? `, ${n.destination}` : ""
    }${dr ? `, ${dr}` : ""})`;
  };

  const parentBlock = ctx.parent
    ? `\nAquest pla forma part d'un viatge més gran (POTS editar el pare amb les funcions \`*_parent\`):
- Pla pare: ${nodeHeader(ctx.parent)}. Resum: ${ctx.parent.summary}. Enllaç: /plans/${ctx.parent.id}${renderNodeContent(ctx.parent, "")}`
    : "";

  const childrenBlock =
    ctx.children.length > 0
      ? `\nSub-plans (peces d'aquest viatge) — usa el seu body per a càlculs per país/regió. Per editar-los usa les funcions \`*_subplan\` passant el subplan_id=... d'aquí. Els NETS (sub-plans d'un sub-plan) també s'editen amb \`*_subplan\` passant el seu propi subplan_id:\n${ctx.children
          .map((c) => {
            const header = `### Sub-plan: ${nodeHeader(c)} — subplan_id=${c.id} · Enllaç: /plans/${c.id}\nResum: ${c.summary}`;
            const content = renderNodeContent(c, "");
            const grand =
              c.children && c.children.length > 0
                ? `\n${c.children
                    .map(
                      (g) =>
                        `#### Net (dins de "${c.title}"): ${nodeHeader(g)} — subplan_id=${g.id} · Enllaç: /plans/${g.id}\nResum: ${g.summary}${renderNodeContent(g, "  ")}`,
                    )
                    .join("\n\n")}`
                : "";
            return `${header}${content}${grand}`;
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

### 7. MODE ACTUAL: ${mode === "conversa" ? "CONVERSA" : "EDICIÓ"}

${
  mode === "conversa"
    ? `Estàs en mode CONVERSA. NO pots fer canvis al plan — només respondre. Si l'usuari et demana afegir/crear coses, recorda-li amablement que ha de canviar a "Edició" a la barra superior del xat per fer-ho. Exemple:

Usuari: "afegeix Cinema Verdi al mapa"
Tu: "Per afegir-lo al mapa cal que canviïs a mode Edició a dalt del xat — des d'allà podràs confirmar la proposta. Si em dius una mica més de què és (ciutat, etc.) jo prepararé la cerca quan canviïs."`
    : `Estàs en mode EDICIÓ. Tens funcions disponibles per proposar modificacions, tant sobre EL PLAN ACTUAL com sobre els seus SUB-PLANS.

**PLAN ACTUAL — AFEGIR** (creació):
- \`add_place(name, search_query, why?)\` — afegir un lloc al mapa
- \`add_checklist_item(text)\` — afegir un item a la checklist
- \`add_subplan(title, plan_type, summary, destination?, start_date?, end_date?)\` — crear un sub-plan

**PLAN ACTUAL — EDITAR** (modificació):
- \`update_plan_metadata(title?, summary?, destination?, start_date?, end_date?)\` — canvia un o més camps de metadades (almenys un)
- \`update_plan_body(new_body, summary?)\` — substitueix el cos sencer del plan (Markdown)
- \`update_checklist_item(item_id, text?, done?)\` — edita text o estat d'un ítem (usa l'id de la llista 'Checklist')

**PLAN ACTUAL — ESBORRAR**:
- \`delete_place(place_id)\` — treu un lloc del mapa (usa l'id de la llista 'Llocs al mapa')

**SUB-PLANS** (fills d'aquest plan) — passa sempre el \`subplan_id\` de la secció 'Sub-plans':
- \`update_subplan_body(subplan_id, new_body, summary?)\` — reescriu el cos d'un sub-plan
- \`update_subplan_metadata(subplan_id, title?, summary?, destination?, start_date?, end_date?)\` — metadades d'un sub-plan
- \`add_subplan_checklist_item(subplan_id, text)\` / \`update_subplan_checklist_item(subplan_id, item_id, text?, done?)\` — checklist del sub-plan
- \`add_subplan_place(subplan_id, name, search_query, why?, arrival_date?)\` / \`delete_subplan_place(subplan_id, place_id)\` — llocs del sub-plan

Els **NETS** (sub-plans d'un sub-plan) s'editen igual: amb les funcions \`*_subplan\` passant el subplan_id del NET (apareix al context sota el seu sub-plan pare).

**PLA PARE** (només si aquest pla en té un — secció "Aquest pla forma part d'un viatge més gran"):
- \`update_parent_body(new_body, summary?)\`, \`update_parent_metadata(...)\`
- \`add_parent_checklist_item(text)\` / \`update_parent_checklist_item(item_id, text?, done?)\`
- \`add_parent_place(name, search_query, why?, arrival_date?)\` / \`delete_parent_place(place_id)\`
Cap d'aquestes porta id de pla (el pare és únic); l'item_id/place_id els tens a la secció del pare.

Els ids (subplan_id, item_id, place_id) els tens al context (sota cada sub-plan, net o el pare). NO els inventis.

**REGLA CLAU**: distingeix VERB IMPERATIU vs PREGUNTA. Només crida una funció si l'usuari et dóna una ORDRE explícita ("afegeix...", "canvia...", "esborra...", "treu..."). Per a tota la resta, respon en TEXT.

✅ Crida funció:
- "Afegeix Cinema Verdi al mapa" → \`add_place\`
- "Canvia el títol a 'Aventura Asiàtica'" → \`update_plan_metadata\`
- "Treu Sydney del mapa" → \`delete_place\`
- "Marca 'Comprar adaptador' com a fet" → \`update_checklist_item\`
- "Reescriu el body sense referències a Austràlia" → \`update_plan_body\` (amb el body COMPLET nou)
- "Actualitza el resum del sub-plan Vietnam" → \`update_subplan_metadata\` (amb el seu subplan_id)
- "Afegeix una secció de transport al sub-plan Tailàndia" → \`update_subplan_body\` (body COMPLET del sub-plan)
- "Marca l'ítem X de la checklist del sub-plan Vietnam" → \`update_subplan_checklist_item\`

❌ NO crides funció (només text):
- "Què em recomanaries afegir?" → text amb suggeriments
- "Quin títol em proposes?" → text amb opcions, acaba amb "Vols que el canviï?"
- "Què hauria d'esborrar?" → text llistant possibles candidats

**REGLES ESPECÍFIQUES per update_plan_body**:
1. Has de retornar el BODY COMPLET, no un diff ni només la part nova.
2. PRESERVA totes les imatges inline \`![](pp:...)\` que ja hi havia (excepte si l'usuari demana treure-les explícitament).
3. PRESERVA el to, l'estructura H2/H3 i les imatges de seccions no afectades.
4. Si l'edit és puntual (canviar 1-2 frases), valora si val més enviar el body sencer o demanar a l'usuari que ho faci des de l'editor.

**REGENERA EL RESUM (índex) quan toca**: quan reescriguis el body (\`update_plan_body\` o \`update_subplan_body\`) i el canvi sigui substancial, passa també \`summary\` amb un resum nou (1-2 frases) perquè la targeta de l'índex i l'entradilla quedin al dia. Fes-ho SEMPRE QUE PUGUIS, no per canvis menors.

**EDITS MASSIUS** ("treu X de tot", "actualitza totes les referències a Y"):
Pots cridar diverses funcions en una sola resposta per cobrir-ho tot. Exemple, si l'usuari diu "treu Austràlia de tot": crida \`update_plan_metadata\` (destination, summary), \`update_plan_body\` (nou body sense referències), \`delete_place\` per a cada lloc australià, \`update_checklist_item\` per a cada ítem que el mencioni. Si hi ha sub-plans afectats, pots editar-los directament amb les funcions \`*_subplan*\` corresponents (passant el subplan_id) — ja no cal que l'usuari obri el chat del sub-plan.

Quan cridis una funció, escriu també un MISSATGE BREU confirmant la proposta. L'usuari haurà de confirmar cadascuna abans que s'apliqui.`
}

### 8. Quan no pots
- Sub-plans i nets: SÍ que pots editar-los amb les funcions \`*_subplan\` (mode edició) passant el subplan_id corresponent. Si no el tens, demana de quin parla.
- Pla pare: SÍ que el pots editar amb les funcions \`*_parent\` (si aquest pla en té un). Si no en té, digues-ho.
- Dades genuïnament absents: digues-ho i ofereix una aproximació o una acció.

### 9. To
Català, càlid, personal, com un amic que ajuda a planificar. Sense corporativisme.`;
}
