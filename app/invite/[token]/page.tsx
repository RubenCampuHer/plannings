import { redirect } from "next/navigation";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { acceptInvitationByToken } from "@/lib/invitation-actions";
import { createSupabaseServer } from "@/lib/supabase-server";

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();

  // Sense usuari: l'enviem al login amb next=/invite/[token].
  if (!user) {
    redirect(`/login?next=${encodeURIComponent(`/invite/${token}`)}`);
  }

  // Provem d'acceptar la invitació.
  const result = await acceptInvitationByToken(token);

  if ("planId" in result) {
    redirect(`/plans/${result.planId}`);
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-md text-center">
        <span className="grid place-items-center h-14 w-14 mx-auto rounded-full bg-peach text-white shadow-[0_4px_0_0_rgba(226,122,69,0.25)]">
          <Sparkles className="h-6 w-6" strokeWidth={2.25} />
        </span>
        <h1 className="font-serif text-2xl font-semibold text-ink mt-5">
          Aquesta invitació no es pot acceptar
        </h1>
        <p className="text-ink-soft mt-3 text-sm">{result.error}</p>
        <div className="mt-8">
          <Link href="/">
            <Button variant="outline">Tornar a inici</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
