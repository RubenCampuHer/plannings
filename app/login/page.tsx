import type { Metadata } from "next";
import Link from "next/link";
import { Sparkles, Mail, Lock, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { signInWithPassword, signUpWithPassword } from "@/lib/auth-actions";

export const metadata: Metadata = {
  title: "Entrar · Plannings",
};

type Mode = "signin" | "signup";

const ERROR_MESSAGES: Record<string, string> = {
  missing_fields: "Posa el correu i la contrasenya.",
  short_password: "La contrasenya ha de tenir 6 caràcters com a mínim.",
};

function translateError(raw: string | undefined): string | null {
  if (!raw) return null;
  if (ERROR_MESSAGES[raw]) return ERROR_MESSAGES[raw];
  // Errors comuns de Supabase en anglès, els traduïm si toca.
  if (/invalid login credentials/i.test(raw)) return "Correu o contrasenya incorrectes.";
  if (/already registered/i.test(raw)) return "Ja existeix un compte amb aquest correu. Entra-hi.";
  if (/no està autoritzat/i.test(raw)) return raw; // missatge del trigger ja en català
  return raw;
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string; error?: string; confirm?: string }>;
}) {
  const sp = await searchParams;
  const mode: Mode = sp.mode === "signup" ? "signup" : "signin";
  const errorMsg = translateError(sp.error);
  const confirmEmail = sp.confirm;

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
              ? "El vostre raconet privat de plans."
              : "Només els correus a la whitelist poden registrar-se."}
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

        <form
          action={isSignin ? signInWithPassword : signUpWithPassword}
          className="space-y-4"
        >
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
          <Button type="submit" variant="primary" className="w-full">
            {isSignin ? "Entra" : "Crea el compte"}
          </Button>
          <p className="text-xs text-ink-soft text-center pt-2">
            Només dues persones podem entrar aquí. Si no ets vosaltres, no et deixarà passar.
          </p>
        </form>
      </div>
    </div>
  );
}
