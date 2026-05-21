import { cookies, headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";

export const SUPPORTED_LOCALES = ["ca", "es", "en"] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "ca";

function pickLocale(raw: string | undefined): Locale {
  const candidate = raw?.split("-")[0]?.toLowerCase();
  if (candidate && SUPPORTED_LOCALES.includes(candidate as Locale)) {
    return candidate as Locale;
  }
  return DEFAULT_LOCALE;
}

/**
 * Decideix el locale actiu per a aquest request:
 * 1) cookie NEXT_LOCALE si l'usuari l'ha triat
 * 2) primer locale d'Accept-Language compatible
 * 3) català per defecte
 */
export async function detectLocale(): Promise<Locale> {
  const cookieStore = await cookies();
  const fromCookie = cookieStore.get("NEXT_LOCALE")?.value;
  if (fromCookie) {
    const valid = pickLocale(fromCookie);
    if (fromCookie === valid) return valid;
  }

  const hdr = await headers();
  const accept = hdr.get("accept-language") ?? "";
  const first = accept.split(",")[0]?.trim();
  return pickLocale(first);
}

export default getRequestConfig(async () => {
  const locale = await detectLocale();
  const messages = (await import(`../messages/${locale}.json`)).default;
  return { locale, messages };
});
