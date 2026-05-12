"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServer } from "./supabase-server";

export type GeocodeResult = {
  displayName: string;
  name: string;
  country: string | null;
  lat: number;
  lng: number;
};

// Nominatim (OpenStreetMap) — gratis, sense API key. Política d'ús:
// User-Agent identificable + no abusar. Per a 2 usuaris és innòcu.
// https://operations.osmfoundation.org/policies/nominatim/
export async function geocodeSearch(query: string): Promise<GeocodeResult[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", q);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "6");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("accept-language", "ca,es,en");

  const res = await fetch(url, {
    headers: {
      "User-Agent": "plannings/1.0 (web privada de 2 usuaris; ruben@aima.chat)",
    },
    // Nominatim té una latència variable; cache curta perquè consultes repetides
    // dins de la mateixa cerca no espamegin.
    next: { revalidate: 60 },
  });

  if (!res.ok) {
    throw new Error(`Nominatim ${res.status}: ${res.statusText}`);
  }

  const data = (await res.json()) as Array<{
    display_name: string;
    name?: string;
    lat: string;
    lon: string;
    address?: { country?: string; city?: string; town?: string; village?: string };
  }>;

  return data.map((item) => {
    const addr = item.address ?? {};
    const niceName =
      item.name || addr.city || addr.town || addr.village || item.display_name.split(",")[0].trim();
    return {
      displayName: item.display_name,
      name: niceName,
      country: addr.country ?? null,
      lat: Number(item.lat),
      lng: Number(item.lon),
    };
  });
}

export async function addPlace(planId: string, place: {
  name: string;
  country: string | null;
  lat: number;
  lng: number;
  notes?: string;
  arrivalDate?: string;
}): Promise<void> {
  const supabase = await createSupabaseServer();

  // Calcula el següent order_index per posar el lloc al final.
  const { data: existing } = await supabase
    .from("places")
    .select("order_index")
    .eq("plan_id", planId)
    .order("order_index", { ascending: false })
    .limit(1);
  const nextIndex = (existing?.[0]?.order_index ?? -1) + 1;

  const id = crypto.randomUUID();
  const { error } = await supabase.from("places").insert({
    id,
    plan_id: planId,
    name: place.name,
    country: place.country,
    lat: place.lat,
    lng: place.lng,
    notes: place.notes ?? null,
    arrival_date: place.arrivalDate ?? null,
    order_index: nextIndex,
  });
  if (error) throw new Error(`Afegir lloc: ${error.message}`);

  revalidatePath(`/plans/${planId}`);
  revalidatePath(`/plans/${planId}/edit`);
}

export async function deletePlace(planId: string, placeId: string): Promise<void> {
  const supabase = await createSupabaseServer();
  const { error } = await supabase
    .from("places")
    .delete()
    .eq("id", placeId)
    .eq("plan_id", planId);
  if (error) throw new Error(`Esborrar lloc: ${error.message}`);

  revalidatePath(`/plans/${planId}`);
  revalidatePath(`/plans/${planId}/edit`);
}
