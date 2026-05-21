import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServer } from "@/lib/supabase-server";

// GET endpoint que inicia el flow OAuth amb Google.
// Cal fer-ho en un route handler (no en un server action) perquè
// el redirect a la URL externa d'autorització de Google es respecti.
export async function GET(request: NextRequest) {
  const { origin, searchParams } = new URL(request.url);
  const rawNext = searchParams.get("next") ?? "";
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/";

  const supabase = await createSupabaseServer();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });

  if (error || !data?.url) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(error?.message ?? "oauth_failed")}`,
    );
  }

  return NextResponse.redirect(data.url);
}
