"use client";

import { useEffect, useState, useTransition } from "react";
import { ArrowDown, ArrowUp, MapPin, Plus, Search, Trash2 } from "lucide-react";
import { MapSection } from "@/components/plan-detail/map-section";
import {
  addPlace,
  deletePlace,
  geocodeSearch,
  reorderPlaces,
  setPlaceArrivalDate,
  setPlaceZone,
  type GeocodeResult,
} from "@/lib/place-actions";
import type { Place } from "@/lib/types";

const FIELD =
  "w-full h-11 pl-10 pr-3 rounded-md border border-ink-faint/60 bg-cream-soft text-ink text-base sm:text-sm placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-peach/40 focus:border-peach/40";

export function PlacesEditor({
  planId,
  initialPlaces,
}: {
  planId: string;
  initialPlaces: Place[];
}) {
  const [places, setPlaces] = useState<Place[]>(initialPlaces);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // Sync amb props quan el server re-render després d'un revalidatePath.
  useEffect(() => {
     
    setPlaces(initialPlaces);
  }, [initialPlaces]);

  // Cerca amb debounce de 350ms.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
       
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const r = await geocodeSearch(q);
        setResults(r);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg);
      } finally {
        setSearching(false);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [query]);

  function pickResult(r: GeocodeResult) {
    setError(null);
    const tempId = `temp-${crypto.randomUUID()}`;
    const optimistic: Place = {
      id: tempId,
      name: r.name,
      country: r.country ?? undefined,
      lat: r.lat,
      lng: r.lng,
      orderIndex: places.length,
    };
    setPlaces((prev) => [...prev, optimistic]);
    setQuery("");
    setResults([]);
    startTransition(async () => {
      try {
        await addPlace(planId, {
          name: r.name,
          country: r.country,
          lat: r.lat,
          lng: r.lng,
        });
      } catch (e) {
        setPlaces((prev) => prev.filter((p) => p.id !== tempId));
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg);
      }
    });
  }

  function handleDelete(placeId: string) {
    setError(null);
    const before = places;
    setPlaces((prev) => prev.filter((p) => p.id !== placeId));
    startTransition(async () => {
      try {
        await deletePlace(planId, placeId);
      } catch (e) {
        setPlaces(before);
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg);
      }
    });
  }

  function setZone(placeId: string, value: string) {
    const zone = value.trim() || null;
    const before = places;
    setError(null);
    setPlaces((prev) =>
      prev.map((p) => (p.id === placeId ? { ...p, zone: zone ?? undefined } : p)),
    );
    startTransition(async () => {
      try {
        await setPlaceZone(planId, placeId, zone);
      } catch (e) {
        setPlaces(before);
        setError(e instanceof Error ? e.message : String(e));
      }
    });
  }

  // Posa la mateixa data a tots els llocs d'una zona (una sola acció).
  function setGroupDate(ids: string[], value: string) {
    const date = value || null;
    const before = places;
    setError(null);
    setPlaces((prev) =>
      prev.map((p) =>
        ids.includes(p.id) ? { ...p, arrivalDate: date ?? undefined } : p,
      ),
    );
    startTransition(async () => {
      try {
        await Promise.all(ids.map((id) => setPlaceArrivalDate(planId, id, date)));
      } catch (e) {
        setPlaces(before);
        setError(e instanceof Error ? e.message : String(e));
      }
    });
  }

  function move(index: number, direction: "up" | "down") {
    const target = direction === "up" ? index - 1 : index + 1;
    if (target < 0 || target >= places.length) return;
    setError(null);
    const before = places;
    const next = [...places];
    [next[index], next[target]] = [next[target], next[index]];
    setPlaces(next);
    startTransition(async () => {
      try {
        await reorderPlaces(
          planId,
          next.map((p) => p.id),
        );
      } catch (e) {
        setPlaces(before);
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg);
      }
    });
  }

  // Agrupa els llocs per zona, conservant l'índex global (per a reordenar) i
  // l'ordre d'aparició. La zona buida ("Sense zona") va sempre al final.
  const indexed = places.map((p, i) => ({ p, i }));
  const groupKeys: string[] = [];
  const groupMap = new Map<string, { p: Place; i: number }[]>();
  for (const it of indexed) {
    const key = it.p.zone?.trim() ? it.p.zone.trim() : "";
    if (!groupMap.has(key)) {
      groupMap.set(key, []);
      groupKeys.push(key);
    }
    groupMap.get(key)!.push(it);
  }
  const orderedKeys = [
    ...groupKeys.filter((k) => k),
    ...(groupMap.has("") ? [""] : []),
  ];
  const groups = orderedKeys.map((key) => ({ key, items: groupMap.get(key)! }));
  const zoneNames = groupKeys.filter((k) => k);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-serif text-xl font-semibold text-ink mb-1">Llocs al mapa</h2>
        <p className="text-sm text-ink-soft">
          Busca un lloc per nom o adreça (ex. &laquo;Cinema Verdi Barcelona&raquo;, &laquo;Bangkok&raquo;).
          S&apos;afegeix al mapa al moment.
        </p>
      </div>

      {/* Search */}
      <div className="space-y-2">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-soft" strokeWidth={2} />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cerca un lloc…"
            className={FIELD}
          />
          {searching && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-ink-soft">cercant…</span>
          )}
        </div>

        {results.length > 0 && (
          <ul className="rounded-md border border-ink-faint/40 bg-cream-soft divide-y divide-ink-faint/20 overflow-hidden">
            {results.map((r, i) => (
              <li key={`${r.lat}-${r.lng}-${i}`}>
                <button
                  type="button"
                  onClick={() => pickResult(r)}
                  className="w-full text-left px-3 py-2.5 hover:bg-peach-soft/30 transition-colors flex items-start gap-3"
                >
                  <Plus className="h-4 w-4 mt-0.5 text-peach-deep shrink-0" strokeWidth={2.5} />
                  <span className="flex-1 min-w-0">
                    <span className="block font-medium text-ink">{r.name}</span>
                    <span className="block text-xs text-ink-soft truncate">{r.displayName}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}

        {error && (
          <div className="rounded-md border border-peach-deep/40 bg-peach-soft/40 px-3 py-2 text-sm text-ink">
            {error}
          </div>
        )}
      </div>

      {/* Llocs existents, agrupats per zona */}
      {places.length > 0 && (
        <div className="space-y-4">
          <p className="text-xs uppercase tracking-wider text-ink-soft">
            {places.length} {places.length === 1 ? "lloc" : "llocs"} · organitza per zones
          </p>
          {/* Suggeriments de zona ja existents (autocompletat). */}
          <datalist id={`zones-${planId}`}>
            {zoneNames.map((z) => (
              <option key={z} value={z} />
            ))}
          </datalist>

          {groups.map((g) => {
            const ids = g.items.map((it) => it.p.id);
            const dateSet = new Set(g.items.map((it) => it.p.arrivalDate ?? ""));
            const commonDate = dateSet.size === 1 ? [...dateSet][0] : "";
            return (
              <div
                key={g.key || "__none"}
                className="rounded-md border border-ink-faint/30 bg-cream-soft/40 overflow-hidden"
              >
                <div className="flex items-center gap-2 px-3 py-2 border-b border-ink-faint/30 bg-cream-soft/60">
                  <span className="font-serif font-semibold text-ink text-sm flex-1 truncate">
                    {g.key || "Sense zona"}
                  </span>
                  <input
                    type="date"
                    value={commonDate}
                    onChange={(e) => setGroupDate(ids, e.target.value)}
                    aria-label={`Data de ${g.key || "sense zona"}`}
                    title="Aplica la data a tota la zona"
                    className="h-8 px-2 rounded-md border border-ink-faint/50 bg-cream text-ink-soft text-base sm:text-xs focus:outline-none focus:ring-2 focus:ring-peach/30"
                  />
                  <span className="text-xs text-ink-soft tabular-nums shrink-0">
                    {g.items.length}
                  </span>
                </div>
                <ul className="divide-y divide-ink-faint/20">
                  {g.items.map(({ p, i }) => {
                    const isTemp = p.id.startsWith("temp-");
                    const isFirst = i === 0;
                    const isLast = i === places.length - 1;
                    return (
                      <li
                        key={p.id}
                        className="flex items-center gap-2 px-3 py-2 group"
                      >
                        <span className="flex-1 min-w-0">
                          <span className="block text-sm font-medium text-ink truncate">
                            {p.name}
                            {p.country && (
                              <span className="text-xs text-ink-soft font-normal"> · {p.country}</span>
                            )}
                          </span>
                          <input
                            list={`zones-${planId}`}
                            defaultValue={p.zone ?? ""}
                            placeholder="zona…"
                            disabled={isTemp}
                            onBlur={(e) => {
                              const v = e.target.value.trim() || null;
                              if (v !== (p.zone ?? null)) setZone(p.id, e.target.value);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") e.currentTarget.blur();
                            }}
                            aria-label={`Zona de ${p.name}`}
                            className="mt-1 h-7 px-2 rounded border border-ink-faint/50 bg-cream text-ink-soft text-base sm:text-xs focus:outline-none focus:ring-2 focus:ring-peach/30 disabled:opacity-50"
                          />
                        </span>
                        <div className="flex items-center gap-1 sm:gap-0.5 opacity-70 sm:opacity-40 sm:group-hover:opacity-100 transition">
                          <button
                            type="button"
                            onClick={() => move(i, "up")}
                            disabled={isTemp || isFirst}
                            className="grid place-items-center min-h-[40px] min-w-[40px] sm:min-h-0 sm:min-w-0 sm:p-1 text-ink-soft hover:text-ink disabled:opacity-30 disabled:cursor-not-allowed transition"
                            aria-label={`Pujar ${p.name}`}
                          >
                            <ArrowUp className="h-4 w-4" strokeWidth={2} />
                          </button>
                          <button
                            type="button"
                            onClick={() => move(i, "down")}
                            disabled={isTemp || isLast}
                            className="grid place-items-center min-h-[40px] min-w-[40px] sm:min-h-0 sm:min-w-0 sm:p-1 text-ink-soft hover:text-ink disabled:opacity-30 disabled:cursor-not-allowed transition"
                            aria-label={`Baixar ${p.name}`}
                          >
                            <ArrowDown className="h-4 w-4" strokeWidth={2} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(p.id)}
                            disabled={isTemp}
                            className="grid place-items-center min-h-[40px] min-w-[40px] sm:min-h-0 sm:min-w-0 sm:p-1 text-ink-soft hover:text-peach-deep transition disabled:cursor-wait"
                            aria-label={`Esborrar ${p.name}`}
                          >
                            <Trash2 className="h-4 w-4" strokeWidth={2} />
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>
      )}

      {/* Live map preview */}
      {places.length > 0 ? (
        <MapSection places={places} />
      ) : (
        <div className="h-[280px] rounded-[var(--radius-card)] border border-dashed border-ink-faint/40 bg-cream-soft/40 grid place-items-center text-center px-6">
          <div>
            <MapPin className="h-8 w-8 mx-auto text-ink-faint mb-2" strokeWidth={1.5} />
            <p className="text-sm text-ink-soft">
              Encara no hi ha cap lloc. Busca&apos;n un a sobre.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
