"use client";

import dynamic from "next/dynamic";
import type { Place } from "@/lib/types";

// Leaflet touches `window` at import time, so we keep it strictly client-side.
const MapView = dynamic(() => import("./map-view"), {
  ssr: false,
  loading: () => (
    <div className="h-[280px] sm:h-[420px] w-full rounded-[var(--radius-card)] bg-cream-soft border border-ink-faint/40 grid place-items-center text-ink-soft text-sm">
      Carregant mapa…
    </div>
  ),
});

export function MapSection({ places }: { places: Place[] }) {
  return <MapView places={places} />;
}
