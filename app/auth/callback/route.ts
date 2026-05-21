import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServer } from "@/lib/supabase-server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  // Supabase pot tornar errors per query string (p.ex. quan el trigger
  // de beta_invites rebutja un signup OAuth). Els surfacem al login.
  const errorCode = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");
  if (errorCode || errorDescription) {
    console.error("[auth/callback] OAuth error:", { errorCode, errorDescription });
    const message = errorDescription || errorCode || "oauth_error";
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(message)}`,
    );
  }

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`);
  }

  const supabase = await createSupabaseServer();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    console.error("[auth/callback] exchangeCodeForSession error:", error.message);
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(error.message)}`,
    );
  }

  return NextResponse.redirect(`${origin}${next}`);
}
