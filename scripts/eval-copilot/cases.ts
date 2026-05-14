// Bateria de preguntes per avaluar el copilot. Cobreix els casos d'ús que ens
// importen: càlculs amb dades específiques vs agregades, comparacions, links
// a sub-seccions, navegació entre pare/fill, recomanacions basades en el body.

export type EvalCase = {
  id: string;
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
  >;
  /** Per al judge: què hauria de fer una resposta excel·lent. */
  ideal_behavior: string;
};

export const CASES: EvalCase[] = [
  {
    id: "budget-aggregate",
    question: "Quin és el pressupost global del viatge?",
    focus: ["calculation"],
    ideal_behavior:
      "Donar la xifra exacta del body i, si hi ha desglossament, dir-ne els components.",
  },
  {
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
    id: "compare-cost",
    question: "Quin país sortirà més car, Indonèsia o Tailàndia?",
    focus: ["comparison", "specific-over-aggregate", "calculation"],
    ideal_behavior:
      "Comparar costos diaris específics si hi són; si no, mirar la durada/activitats descrites. Argumentar.",
  },
  {
    id: "duration-per-region",
    question: "Quants dies passem a cada país de la fase asiàtica?",
    focus: ["calculation", "section-linking"],
    ideal_behavior:
      "Llistar país + dies. Si dates específiques existeixen, calcular-les. Enllaçar a la secció corresponent.",
  },
  {
    id: "section-link",
    question:
      "On parla el pla del transport intern? Vull veure els detalls exactes.",
    focus: ["section-linking"],
    ideal_behavior:
      "Enllaçar a la H3 més específica si existeix (no a una H2 genèrica com 'Pressupost' o 'Detalls').",
  },
  {
    id: "first-day",
    question: "Què tenim previst per al primer dia del viatge?",
    focus: ["section-linking", "recommendation"],
    ideal_behavior:
      "Resumir el que diu el body sobre el primer dia. Enllaçar a la secció si n'hi ha.",
  },
  {
    id: "recommend-restaurant",
    question:
      "Recomana'm 2 restaurants típics per a la zona on anem primer. Que siguin assequibles.",
    focus: ["recommendation"],
    ideal_behavior:
      "Donar recomanacions concretes amb noms reals, sense inventar preus. Si el body cita restaurants, mencionar-los.",
  },
  {
    id: "checklist-state",
    question: "Què ens queda per preparar abans de marxar?",
    focus: ["recommendation"],
    ideal_behavior:
      "Llistar els items de checklist no fets. Si tots són fets, dir-ho. Suggerir afegits si la checklist sembla buida.",
  },
  {
    id: "no-data-fallback",
    question: "Què es paga d'assegurança mèdica per a un viatge així?",
    focus: ["honest-fallback"],
    ideal_behavior:
      "Si el body no en parla, dir-ho clarament i donar un ordre de magnitud raonable (sense fingir que ho sap del body). Suggerir afegir-ho a la checklist o al pressupost.",
  },
  {
    id: "subplan-summary",
    question: "Quin és l'estat del Vietnam dins del viatge?",
    focus: ["subplan-navigation", "section-linking"],
    ideal_behavior:
      "Si Vietnam és un sub-plan, mencionar-ho i enllaçar a /plans/{id}. Si està descrit al body, resumir-lo.",
  },
  // ===== M8.2: comandes que haurien de generar function calls =====
  {
    id: "command-add-place",
    question: "Afegeix Cinema Verdi Barcelona al mapa.",
    focus: ["recommendation"],
    ideal_behavior:
      "Hauria de cridar la funció add_place amb name='Cinema Verdi' (o similar) i search_query útil per Nominatim. El text de la resposta hauria de ser BREU confirmant la proposta (ex. 'D'acord, et proposo afegir-lo'). NO ha d'inventar text llarg.",
  },
  {
    id: "command-add-checklist",
    question:
      "Afegeix 'Comprar adaptadors universals' i 'Reservar hotel a Yogyakarta' a la checklist.",
    focus: ["recommendation"],
    ideal_behavior:
      "Hauria de cridar la funció add_checklist_item DOS COPS, una per cada item. Text breu confirmant la proposta.",
  },
  {
    id: "qa-no-command",
    question: "Què em recomanaries afegir a la checklist?",
    focus: ["recommendation"],
    ideal_behavior:
      "Aquesta és una pregunta de Q&A (recomanació) — NO ha de cridar add_checklist_item perquè l'usuari no ha demanat afegir res explícitament. Hauria de respondre amb suggeriments en text. Si l'usuari després diu 'afegeix-los', llavors sí cridaria la funció.",
  },
];
