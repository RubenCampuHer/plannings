import type { Metadata } from "next";
import { Sparkles, Mail, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { requestMagicLink } from "@/lib/auth-actions";

export const metadata: Metadata = {
  title: "Entrar · Plannings",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const sent = sp.sent;
  const error = sp.error;

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <span className="grid place-items-center h-14 w-14 mx-auto rounded-full bg-peach text-white shadow-[0_4px_0_0_rgba(226,122,69,0.25)]">
            <Sparkles className="h-6 w-6" strokeWidth={2.25} />
          </span>
          <h1 className="font-serif text-3xl font-semibold text-ink mt-5">
            Entra a <span className="italic text-ink-soft font-normal">plannings</span>
          </h1>
          <p className="text-ink-soft mt-2 text-sm">
            Et passem un enllaç màgic al correu. Sense contrasenyes.
          </p>
        </div>

        {sent ? (
          <div className="rounded-lg border border-sage-deep/30 bg-sage-soft/30 p-5 text-center space-y-2">
            <CheckCircle2 className="h-7 w-7 mx-auto text-sage-deep" strokeWidth={2} />
            <p className="font-medium text-ink">Correu enviat</p>
            <p className="text-sm text-ink-soft">
              Hem enviat l'enllaç a <strong className="text-ink">{sent}</strong>. Clica el botó
              del missatge per entrar.
            </p>
          </div>
        ) : (
          <form action={requestMagicLink} className="space-y-4">
            {error && (
              <div className="rounded-md border border-peach-deep/40 bg-peach-soft/40 px-4 py-3 text-sm text-ink">
                {error === "email_required"
                  ? "Posa el teu correu."
                  : error}
              </div>
            )}
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-soft" strokeWidth={2} />
              <input
                type="email"
                name="email"
                required
                autoFocus
                placeholder="el-teu-correu@exemple.com"
                className="w-full h-12 pl-10 pr-4 rounded-full bg-cream-soft border border-ink-faint/50 text-ink placeholder:text-ink-soft/70 focus:outline-none focus:border-peach focus:ring-4 focus:ring-peach/15 transition-all"
              />
            </div>
            <Button type="submit" variant="primary" className="w-full">
              Envia'm l'enllaç
            </Button>
            <p className="text-xs text-ink-soft text-center pt-2">
              Només dues persones podem entrar aquí. Si no ets vosaltres, no et tornarà cap correu.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
