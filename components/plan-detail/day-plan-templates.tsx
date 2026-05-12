"use client";

import { useState } from "react";
import {
  Coffee,
  Croissant,
  Film,
  Footprints,
  Landmark,
  Mountain,
  Music,
  ShoppingBag,
  UtensilsCrossed,
  Waves,
  Wine,
} from "lucide-react";
import { Button } from "@/components/ui/button";

type Activity = {
  key: string;
  label: string;
  icon: typeof Film;
  /** Trozo curt que apareix al títol/resum (ex: "cinema", "una ruta a peu"). */
  fragment: string;
  /** Secció Markdown amb camps en blanc per omplir després. */
  section: string;
};

const ACTIVITIES: Activity[] = [
  {
    key: "brunch",
    label: "Brunch",
    icon: Croissant,
    fragment: "brunch",
    section: "## Brunch\n\n- On: \n- Hora: \n- Què ens ve de gust:",
  },
  {
    key: "cafe",
    label: "Cafè",
    icon: Coffee,
    fragment: "cafè",
    section: "## Cafè\n\n- Cafeteria: \n- Hora:",
  },
  {
    key: "vermut",
    label: "Vermut",
    icon: Wine,
    fragment: "vermut",
    section: "## Vermut\n\n- On: \n- Hora:",
  },
  {
    key: "passeig",
    label: "Passeig",
    icon: Footprints,
    fragment: "passeig",
    section: "## Passeig\n\n- Per on: \n- Quant de temps:",
  },
  {
    key: "ruta",
    label: "Ruta a peu",
    icon: Mountain,
    fragment: "una ruta a peu",
    section:
      "## Ruta a peu\n\n- Punt d'inici: \n- Final: \n- Distància aprox.: \n- Parades pel camí:",
  },
  {
    key: "cinema",
    label: "Cinema",
    icon: Film,
    fragment: "cinema",
    section: "## Cinema\n\n- Pel·lícula: \n- Sessió a: \n- Cinema:",
  },
  {
    key: "concert",
    label: "Concert / esdeveniment",
    icon: Music,
    fragment: "un concert",
    section:
      "## Esdeveniment\n\n- Què: \n- On: \n- Hora: \n- Entrades comprades?:",
  },
  {
    key: "museu",
    label: "Museu",
    icon: Landmark,
    fragment: "museu",
    section: "## Museu\n\n- Quin: \n- Exposició: \n- Hora:",
  },
  {
    key: "mercat",
    label: "Mercat",
    icon: ShoppingBag,
    fragment: "mercat",
    section: "## Mercat\n\n- Quin: \n- Què hi anem a buscar:",
  },
  {
    key: "sopar",
    label: "Sopar",
    icon: UtensilsCrossed,
    fragment: "sopar",
    section: "## Sopar\n\n- On: \n- Hora: \n- Reserva feta?:",
  },
  {
    key: "platja",
    label: "Platja",
    icon: Waves,
    fragment: "platja",
    section: "## Platja\n\n- Quina: \n- Hora: \n- Què portem:",
  },
];

function joinHuman(items: string[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  return `${items.slice(0, -1).join(", ")} i ${items[items.length - 1]}`;
}

export type DayPlanParts = { title: string; summary: string; body: string };

export function DayPlanTemplates({
  onApply,
}: {
  onApply: (parts: DayPlanParts) => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  function toggle(key: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function apply() {
    const picked = ACTIVITIES.filter((a) => selected.has(a.key));
    if (picked.length === 0) return;
    const human = joinHuman(picked.map((a) => a.fragment));
    const title = `Dia de ${human}`;
    const summary = `Dia per ${human}. Pla relaxat, sense pressa.`;
    const body = [`## El plan\n\nDia per ${human}.`, ...picked.map((a) => a.section)].join(
      "\n\n",
    );
    onApply({ title, summary, body });
  }

  return (
    <div className="rounded-lg border border-peach/30 bg-peach-soft/20 p-4 space-y-3">
      <div>
        <p className="font-serif text-base font-semibold text-ink mb-1">
          Plantilla per a dies
        </p>
        <p className="text-sm text-ink-soft">
          Pica les coses que vols fer. En clicar "Aplicar", el cos del plan s'omple
          amb una secció per a cada activitat. El títol i el resum només s'omplen si
          estan buits.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {ACTIVITIES.map((a) => {
          const active = selected.has(a.key);
          const Icon = a.icon;
          return (
            <button
              type="button"
              key={a.key}
              onClick={() => toggle(a.key)}
              className={`h-9 px-3 rounded-full border text-sm font-medium inline-flex items-center gap-1.5 transition ${
                active
                  ? "bg-peach text-white border-peach shadow-[0_2px_0_0_rgba(226,122,69,0.25)]"
                  : "border-ink-faint/60 text-ink-soft bg-cream-soft hover:bg-peach-soft/40 hover:text-ink hover:border-peach/40"
              }`}
            >
              <Icon className="h-4 w-4" strokeWidth={2} />
              {a.label}
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-3 pt-1">
        <Button
          type="button"
          variant="primary"
          size="sm"
          onClick={apply}
          disabled={selected.size === 0}
        >
          Aplicar plantilla
        </Button>
        {selected.size > 0 && (
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            className="text-sm text-ink-soft hover:text-ink"
          >
            Netejar selecció
          </button>
        )}
      </div>
    </div>
  );
}
