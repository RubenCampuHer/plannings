// Bateria de preguntes per avaluar el copilot. Cada cas porta el `mode` amb
// què s'ha de provar (conversa o edicio). Conversa = només Q&A, sense tools.
// Edicio = amb tools, ha de cridar funcions per a ordres imperatives.

import type { ChatMode } from "../../lib/chat-prompt";

export type EvalCase = {
  id: string;
  /** En quin mode del chat es prova aquest cas. */
  mode: ChatMode;
  /** La pregunta que farem al copilot. */
  question: string;
  /** Categories que ens interessa que el judge valori (a part dels comuns). */
  focus: Array<
    | "calculation"
    | "cross-reference"
    | "specific-over-aggregate"
    | "section-linking"
    | "subplan-navigation"
    | "recommendation"
    | "comparison"
    | "honest-fallback"
    | "function-call"
    | "no-function-call"
    | "mode-redirect"
    | "subplan-edit"
  >;
  /** Per al judge: què hauria de fer una resposta excel·lent. */
  ideal_behavior: string;
};

export const CASES: EvalCase[] = [
  // ============== MODE CONVERSA: només Q&A, mai function calls ==============
  {
    mode: "conversa",
    id: "budget-aggregate",
    question: "Quin és el pressupost global del viatge?",
    focus: ["calculation"],
    ideal_behavior:
      "Donar la xifra exacta del body i, si hi ha desglossament, dir-ne els components.",
  },
  {
    mode: "conversa",
    id: "budget-per-country",
    question:
      "Quant ens gastarem aproximadament a Indonèsia? I a Cambodja? Fes-ho per a la parella.",
    focus: [
      "calculation",
      "specific-over-aggregate",
      "cross-reference",
      "section-linking",
    ],
    ideal_behavior:
      "Buscar el cost diari específic de cada país (si hi és) i multiplicar per dies. NO promediar uniformement el pressupost agregat d'Àsia. Mostrar els components. Enllaçar a la sub-secció específica (H3) si existeix.",
  },
  {
    mode: "conversa",
    id: "compare-cost",
    question: "Quin país sortirà més car, Indonèsia o Tailàndia?",
    focus: ["comparison", "specific-over-aggregate", "calculation"],
    ideal_behavior:
      "Comparar costos diaris específics si hi són; si no, mirar la durada/activitats descrites. Argumentar.",
  },
  {
    mode: "conversa",
    id: "duration-per-region",
    question: "Quants dies passem a cada país de la fase asiàtica?",
    focus: ["calculation", "section-linking"],
    ideal_behavior:
      "Llistar país + dies. Si dates específiques existeixen, calcular-les. Enllaçar a la secció corresponent.",
  },
  {
    mode: "conversa",
    id: "section-link",
    question:
      "On parla el pla del transport intern? Vull veure els detalls exactes.",
    focus: ["section-linking"],
    ideal_behavior:
      "Enllaçar a la H3 més específica si existeix (no a una H2 genèrica com 'Pressupost' o 'Detalls').",
  },
  {
    mode: "conversa",
    id: "first-day",
    question: "Què tenim previst per al primer dia del viatge?",
    focus: ["section-linking", "recommendation"],
    ideal_behavior:
      "Resumir el que diu el body sobre el primer dia. Enllaçar a la secció si n'hi ha.",
  },
  {
    mode: "conversa",
    id: "recommend-restaurant",
    question:
      "Recomana'm 2 restaurants típics per a la zona on anem primer. Que siguin assequibles.",
    focus: ["recommendation"],
    ideal_behavior:
      "Donar recomanacions concretes amb noms reals, sense inventar preus. Si el body cita restaurants, mencionar-los.",
  },
  {
    mode: "conversa",
    id: "checklist-state",
    question: "Què ens queda per preparar abans de marxar?",
    focus: ["recommendation"],
    ideal_behavior:
      "Llistar els items de checklist no fets. Si tots són fets, dir-ho. Suggerir afegits si la checklist sembla buida.",
  },
  {
    mode: "conversa",
    id: "no-data-fallback",
    question: "Què es paga d'assegurança mèdica per a un viatge així?",
    focus: ["honest-fallback"],
    ideal_behavior:
      "Si el body no en parla, dir-ho clarament i donar un ordre de magnitud raonable (sense fingir que ho sap del body). Suggerir afegir-ho a la checklist o al pressupost.",
  },
  {
    mode: "conversa",
    id: "subplan-summary",
    question: "Quin és l'estat del Vietnam dins del viatge?",
    focus: ["subplan-navigation", "section-linking"],
    ideal_behavior:
      "Si Vietnam és un sub-plan, mencionar-ho i enllaçar a /plans/{id}. Si està descrit al body, resumir-lo.",
  },
  {
    mode: "conversa",
    id: "conversa-redirect-on-command",
    question: "Afegeix Cinema Verdi Barcelona al mapa.",
    focus: ["mode-redirect"],
    ideal_behavior:
      "Al mode CONVERSA no pot cridar funcions. Hauria de dir amablement que cal canviar a mode Edició per fer-ho — i opcionalment preparar la cerca o oferir-se a fer-ho un cop canviï.",
  },

  // ============== MODE EDICIÓ: cridar funcions per a ordres ==============
  {
    mode: "edicio",
    id: "command-add-place",
    question: "Afegeix Cinema Verdi Barcelona al mapa.",
    focus: ["function-call"],
    ideal_behavior:
      "Hauria de cridar add_place amb name='Cinema Verdi' i search_query útil per Nominatim. Text breu confirmant la proposta. NO ha d'abocar text llarg.",
  },
  {
    mode: "edicio",
    id: "command-add-checklist-multi",
    question:
      "Afegeix 'Comprar adaptadors universals' i 'Reservar hotel a Yogyakarta' a la checklist.",
    focus: ["function-call"],
    ideal_behavior:
      "Hauria de cridar add_checklist_item DOS COPS, un per cada item. Text breu confirmant. El sistema ja rebutja duplicats programàticament.",
  },
  {
    mode: "edicio",
    id: "command-add-subplan",
    question:
      "Crea un sub-plan per a un cap de setmana a Praga el 12-14 d'octubre de 2027.",
    focus: ["function-call"],
    ideal_behavior:
      "Hauria de cridar add_subplan amb plan_type='weekend', dates correctes (2027-10-12 / 2027-10-14), title i summary curt. Text breu confirmant.",
  },
  {
    mode: "edicio",
    id: "qa-no-command-edit-mode",
    question: "Què em recomanaries afegir a la checklist?",
    focus: ["no-function-call", "recommendation"],
    ideal_behavior:
      "AQUESTA és una pregunta (Q&A), no una ordre. Encara que estiguem en mode edició, NO ha de cridar add_checklist_item. Hauria de respondre amb suggeriments en text i preguntar si vol que els afegeixi.",
  },
  {
    mode: "edicio",
    id: "command-update-subplan-metadata",
    question:
      "Canvia el resum del sub-plan de Vietnam perquè digui que és la part central del viatge.",
    focus: ["function-call", "subplan-edit"],
    ideal_behavior:
      "Hauria de cridar update_subplan_metadata amb el subplan_id correcte de Vietnam (del context) i summary nou. Text breu confirmant. NO ha de tocar el plan pare ni demanar que obri el chat del sub-plan.",
  },
  {
    mode: "edicio",
    id: "command-update-subplan-checklist",
    question:
      "Marca com a fet l'ítem de reservar vols dins la checklist del sub-plan de Vietnam.",
    focus: ["function-call", "subplan-edit"],
    ideal_behavior:
      "Hauria de cridar update_subplan_checklist_item amb subplan_id de Vietnam, l'item_id correcte (de la checklist del sub-plan al context) i done=true. Si no hi ha cap ítem clar de vols, hauria de dir-ho en lloc d'inventar un id.",
  },
  {
    mode: "edicio",
    id: "qa-no-command-subplan",
    question: "Què li falta al sub-plan de Vietnam?",
    focus: ["no-function-call", "subplan-edit", "recommendation"],
    ideal_behavior:
      "És una pregunta, no una ordre. NO ha de cridar cap funció *_subplan. Hauria de respondre amb suggeriments en text basant-se en el body/checklist del sub-plan.",
  },
];
