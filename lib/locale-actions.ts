"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

const SUPPORTED = ["ca", "es", "en"] as const;

export async function setLocale(locale: string): Promise<void> {
  if (!(SUPPORTED as readonly string[]).includes(locale)) return;
  const store = await cookies();
  store.set("NEXT_LOCALE", locale, {
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
    sameSite: "lax",
  });
  revalidatePath("/", "layout");
}
