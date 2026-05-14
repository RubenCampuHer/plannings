"use server";

const PEXELS_SEARCH = "https://api.pexels.com/v1/search";

export type PexelsPhoto = {
  id: number;
  photographer: string;
  /** URL a la pàgina del fotògraf a Pexels (atribució opcional). */
  pageUrl: string;
  /** URL d'una mida prou gran per al hero/inline del body. */
  largeUrl: string;
  /** Alt original de Pexels (descripció generada del seu costat). */
  alt: string;
};

type PexelsRawPhoto = {
  id: number;
  photographer: string;
  url: string;
  alt?: string;
  src: {
    large: string;
    large2x: string;
    medium: string;
  };
};

type PexelsRawResponse = {
  photos?: PexelsRawPhoto[];
  total_results?: number;
};

/**
 * Busca a Pexels i torna el millor candidat per a una query. Preferim
 * orientació landscape perquè queda millor com a imatge inline al body.
 *
 * Retorna `null` si la query no troba res — no és error, simplement no hi ha
 * resultat i el caller decideix què fer.
 */
export async function searchPexelsTop(query: string): Promise<PexelsPhoto | null> {
  const apiKey = process.env.PEXELS_API_KEY;
  if (!apiKey) {
    throw new Error("Falta PEXELS_API_KEY a .env.local / Vercel.");
  }

  const url = new URL(PEXELS_SEARCH);
  url.searchParams.set("query", query);
  url.searchParams.set("per_page", "1");
  url.searchParams.set("orientation", "landscape");

  let res: Response;
  try {
    res = await fetch(url, {
      headers: { Authorization: apiKey },
      // Cache curta per estalviar crides si l'usuari reintenta el polish.
      next: { revalidate: 300 },
    });
  } catch (e) {
    throw new Error(
      `No s'ha pogut contactar amb Pexels: ${e instanceof Error ? e.message : String(e)}`,
    );
  }

  if (res.status === 401 || res.status === 403) {
    throw new Error("PEXELS_API_KEY no és vàlida o ha caducat.");
  }
  if (res.status === 429) {
    throw new Error("Has superat la quota de Pexels per ara. Prova d'aquí una estona.");
  }
  if (!res.ok) {
    throw new Error(`Pexels ${res.status}: ${res.statusText}`);
  }

  const data = (await res.json()) as PexelsRawResponse;
  const top = data.photos?.[0];
  if (!top) return null;

  return {
    id: top.id,
    photographer: top.photographer,
    pageUrl: top.url,
    largeUrl: top.src.large2x || top.src.large,
    alt: top.alt ?? "",
  };
}

/**
 * Descarrega una imatge de Pexels i retorna el buffer + content-type.
 * Fa servir global fetch — sense cache, perquè ja l'hem buscat aquesta sessió.
 */
export async function downloadPexelsImage(imageUrl: string): Promise<{
  buffer: ArrayBuffer;
  contentType: string;
}> {
  const res = await fetch(imageUrl, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Descarregar imatge ${res.status}: ${res.statusText}`);
  }
  const buffer = await res.arrayBuffer();
  const contentType = res.headers.get("content-type") || "image/jpeg";
  return { buffer, contentType };
}
