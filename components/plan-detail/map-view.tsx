"use client";

import { MapContainer, TileLayer, Marker, Popup, Polyline } from "react-leaflet";
import L from "leaflet";
import type { Place } from "@/lib/types";

// Build a numbered, peach-colored marker that matches the project palette.
const makeIcon = (label: string) =>
  L.divIcon({
    className: "plan-marker",
    html: `<div class="plan-marker-pin">${label}</div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16],
  });

export default function MapView({ places }: { places: Place[] }) {
  if (places.length === 0) return null;

  const ordered = [...places].sort((a, b) => a.orderIndex - b.orderIndex);
  const positions: [number, number][] = ordered.map((p) => [p.lat, p.lng]);

  // Center on the centroid, with a soft zoom that fits most regional and global routes.
  const center: [number, number] = [
    positions.reduce((acc, [lat]) => acc + lat, 0) / positions.length,
    positions.reduce((acc, [, lng]) => acc + lng, 0) / positions.length,
  ];

  // Pick a zoom heuristic: wide for trans-continental routes, closer for tight ones.
  const lats = positions.map(([lat]) => lat);
  const lngs = positions.map(([, lng]) => lng);
  const span = Math.max(
    Math.max(...lats) - Math.min(...lats),
    Math.max(...lngs) - Math.min(...lngs),
  );
  const zoom = span > 60 ? 2 : span > 20 ? 3 : span > 5 ? 5 : span > 1 ? 9 : 12;

  // En tàctil desactivem l'arrossegament: així un swipe vertical fa scroll de
  // la pàgina en lloc de quedar atrapat panejant el mapa. Els marcadors segueixen
  // sent tappables i hi ha l'enllaç "Obre al Maps" per a la interacció completa.
  // (MapView és client-only via dynamic ssr:false, així que window és segur.)
  const isTouch =
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(pointer: coarse)").matches;

  return (
    <div className="h-[280px] sm:h-[420px] w-full rounded-[var(--radius-card)] overflow-hidden border border-ink-faint/40 shadow-[0_4px_16px_-8px_rgba(58,46,42,0.15)]">
      <MapContainer
        center={center}
        zoom={zoom}
        scrollWheelZoom={false}
        dragging={!isTouch}
        className="h-full w-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {positions.length > 1 && (
          <Polyline
            positions={positions}
            pathOptions={{
              color: "#F4A26E",
              weight: 3,
              opacity: 0.7,
              dashArray: "6 8",
            }}
          />
        )}
        {ordered.map((place, i) => {
          // Universal URL: a mòbil obre l'app de Maps (Google o Apple segons SO),
          // a desktop obre google.com/maps. Centra a les coordenades exactes
          // que tenim de Nominatim.
          const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${place.lat},${place.lng}`;
          return (
            <Marker
              key={place.id}
              position={[place.lat, place.lng]}
              icon={makeIcon(String(i + 1))}
            >
              <Popup>
                <div className="font-sans">
                  <div className="font-serif font-semibold text-ink">{place.name}</div>
                  {place.country && (
                    <div className="text-xs text-ink-soft">{place.country}</div>
                  )}
                  {place.notes && (
                    <div className="text-xs text-ink mt-1">{place.notes}</div>
                  )}
                  <a
                    href={mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block mt-2 text-xs font-medium text-peach-deep hover:text-ink underline underline-offset-2"
                  >
                    Obre al Maps →
                  </a>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}
