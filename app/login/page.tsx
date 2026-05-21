import type { Metadata } from "next";
import Link from "next/link";
import { Sparkles, Mail, Lock, Info, Ticket } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  signInWithPassword,
  signUpWithPassword,
} from "@/lib/auth-actions";

export const metadata: Metadata = {
  title: "Entrar · Plannings",
};

type Mode = "signin" | "signup";

const ERROR_MESSAGES: Record<string, string> = {
  missing_fields: "Posa el correu i la contrasenya.",
  short_password: "La contrasenya ha de tenir 6 caràcters com a mínim.",
  oauth_failed: "No s'ha pogut iniciar l'entrada amb Google. Torna-ho a provar.",
  missing_code: "No s'ha pogut completar l'entrada amb Google.",
  missing_invite_code: "Necessites un codi d'invitació per registrar-te a la beta.",
  invalid_invite_code: "Aquest codi d'invitació no és vàlid.",
  server_misconfigured: "Hi ha un problema al servidor. Avisa al Ruben.",
  beta_claim_failed: "No s'ha pogut validar la invitació. Torna-ho a provar.",
};

function translateError(raw: string | undefined): string | null {
  if (!raw) return null;
  if (ERROR_MESSAGES[raw]) return ERROR_MESSAGES[raw];
  // Errors comuns de Supabase en anglès, els traduïm si toca.
  if (/invalid login credentials/i.test(raw)) return "Correu o contrasenya incorrectes.";
  if (/already registered/i.test(raw)) return "Ja existeix un compte amb aquest correu. Entra-hi.";
  if (/no està convidat/i.test(raw)) return raw; // missatge del trigger en català
  if (/no està autoritzat/i.test(raw)) return raw;
  // OAuth: signup d'un email sense invitació passa pel trigger i Supabase ho
  // empaqueta com a "Database error saving new user".
  if (/database error saving new user/i.test(raw)) {
    return "Aquest correu no està convidat a la beta de plannings.";
  }
  return raw;
}

function GoogleIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 48 48"
      className="h-4 w-4"
      aria-hidden
    >
      <path
        fill="#FFC107"
        d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4C12.955 4 4 12.955 4 24s8.955 20 20 20s20-8.955 20-20c0-1.341-.138-2.65-.389-3.917"
      />
      <path
        fill="#FF3D00"
        d="m6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4C16.318 4 9.656 8.337 6.306 14.691"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44"
      />
      <path
        fill="#1976D2"
        d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002l6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917"
      />
    </svg>
  );
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string; error?: string; confirm?: string; next?: string }>;
}) {
  const sp = await searchParams;
  const mode: Mode = sp.mode === "signup" ? "signup" : "signin";
  const errorMsg = translateError(sp.error);
  const confirmEmail = sp.confirm;
  // Sanititzem el next: només paths interns.
  const rawNext = typeof sp.next === "string" ? sp.next : "";
  const nextPath = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/";

  const isSignin = mode === "signin";

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <span className="grid place-items-center h-14 w-14 mx-auto rounded-full bg-peach text-white shadow-[0_4px_0_0_rgba(226,122,69,0.25)]">
            <Sparkles className="h-6 w-6" strokeWidth={2.25} />
          </span>
          <h1 className="font-serif text-3xl font-semibold text-ink mt-5">
            {isSignin ? "Entra a" : "Crea compte a"}{" "}
            <span className="italic text-ink-soft font-normal">plannings</span>
          </h1>
          <p className="text-ink-soft mt-2 text-sm">
            {isSignin
              ? "El teu raconet de plans i records."
              : "Estem en beta — necessites una invitació per registrar-te."}
          </p>
        </div>

        {/* Tabs */}
        <div className="grid grid-cols-2 gap-1 p-1 rounded-full bg-cream-soft border border-ink-faint/40 mb-6">
          <Link
            href="/login?mode=signin"
            className={`text-center py-2 rounded-full text-sm font-medium transition-colors ${
              isSignin ? "bg-white text-ink shadow-sm" : "text-ink-soft hover:text-ink"
            }`}
          >
            Entra
          </Link>
          <Link
            href="/login?mode=signup"
            className={`text-center py-2 rounded-full text-sm font-medium transition-colors ${
              !isSignin ? "bg-white text-ink shadow-sm" : "text-ink-soft hover:text-ink"
            }`}
          >
            Crea compte
          </Link>
        </div>

        {confirmEmail && isSignin && (
          <div className="rounded-md border border-sage-deep/30 bg-sage-soft/30 px-4 py-3 text-sm text-ink mb-4 flex gap-2">
            <Info className="h-4 w-4 mt-0.5 shrink-0 text-sage-deep" strokeWidth={2} />
            <p>
              T'hem enviat un correu a <strong>{confirmEmail}</strong> per confirmar el compte.
              Clica l'enllaç i després torna aquí a entrar.
            </p>
          </div>
        )}

        {errorMsg && (
          <div className="rounded-md border border-peach-deep/40 bg-peach-soft/40 px-4 py-3 text-sm text-ink mb-4">
            {errorMsg}
          </div>
        )}

        <a
          href={`/auth/sign-in-google?next=${encodeURIComponent(nextPath)}`}
          className="mb-4 w-full h-12 inline-flex items-center justify-center gap-2 rounded-[var(--radius-button)] bg-cream/60 text-ink border border-ink-faint hover:bg-cream-deep/60 font-medium text-sm transition-all"
        >
          <GoogleIcon />
          Continua amb Google
        </a>

        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 h-px bg-ink-faint/40" />
          <span className="text-xs text-ink-soft uppercase tracking-wide">o amb correu</span>
          <div className="flex-1 h-px bg-ink-faint/40" />
        </div>

        <form
          action={isSignin ? signInWithPassword : signUpWithPassword}
          className="space-y-4"
        >
          <input type="hidden" name="next" value={nextPath} />
          <div className="relative">
            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-soft" strokeWidth={2} />
            <input
              type="email"
              name="email"
              required
              autoFocus
              autoComplete="email"
              placeholder="el-teu-correu@exemple.com"
              className="w-full h-12 pl-10 pr-4 rounded-full bg-cream-soft border border-ink-faint/50 text-ink placeholder:text-ink-soft/70 focus:outline-none focus:border-peach focus:ring-4 focus:ring-peach/15 transition-all"
            />
          </div>
          <div className="relative">
            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-soft" strokeWidth={2} />
            <input
              type="password"
              name="password"
              required
              minLength={6}
              autoComplete={isSignin ? "current-password" : "new-password"}
              placeholder={isSignin ? "Contrasenya" : "Mínim 6 caràcters"}
              className="w-full h-12 pl-10 pr-4 rounded-full bg-cream-soft border border-ink-faint/50 text-ink placeholder:text-ink-soft/70 focus:outline-none focus:border-peach focus:ring-4 focus:ring-peach/15 transition-all"
            />
          </div>
          {!isSignin && (
            <div className="relative">
              <Ticket className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-soft" strokeWidth={2} />
              <input
                type="text"
                name="inviteCode"
                required
                autoComplete="off"
                placeholder="Codi d'invitació"
                className="w-full h-12 pl-10 pr-4 rounded-full bg-cream-soft border border-ink-faint/50 text-ink placeholder:text-ink-soft/70 focus:outline-none focus:border-peach focus:ring-4 focus:ring-peach/15 transition-all"
              />
            </div>
          )}
          <Button type="submit" variant="primary" className="w-full">
            {isSignin ? "Entra" : "Crea el compte"}
          </Button>
        </form>
      </div>
    </div>
  );
}
