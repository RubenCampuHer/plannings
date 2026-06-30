"use client";

import { useEffect, useState, useTransition } from "react";
import { ArrowDown, ArrowUp, MapPin, Plus, Search, Trash2 } from "lucide-react";
import { MapSection } from "@/components/plan-detail/map-section";
import {
  addPlace,
  deletePlace,
  geocodeSearch,
  reorderPlaces,
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

      {/* Existing places */}
      {places.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs uppercase tracking-wider text-ink-soft">
            {places.length} {places.length === 1 ? "lloc" : "llocs"}
          </p>
          <ul className="space-y-1.5">
            {places.map((p, i) => {
              const isTemp = p.id.startsWith("temp-");
              const isFirst = i === 0;
              const isLast = i === places.length - 1;
              return (
                <li
                  key={p.id}
                  className="flex items-center gap-3 px-3 py-2 rounded-md border border-ink-faint/30 bg-cream-soft/60 group"
                >
                  <span className="grid place-items-center h-6 w-6 rounded-full bg-peach text-white text-xs font-medium shrink-0">
                    {i + 1}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-medium text-ink truncate">{p.name}</span>
                    {p.country && (
                      <span className="block text-xs text-ink-soft">{p.country}</span>
                    )}
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
