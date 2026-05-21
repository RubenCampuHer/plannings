"use client";

import { useEffect, useState, useTransition } from "react";
import { Users, X, Copy, Check, UserMinus, LogOut, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  inviteToPlan,
  cancelInvitation,
  removeMember,
  leavePlan,
} from "@/lib/invitation-actions";
import type { PlanInvitation, PlanMember } from "@/lib/types";

type Props = {
  planId: string;
  currentUserId: string;
  members: PlanMember[];
  invitations: PlanInvitation[];
  baseUrl: string;
};

export function MembersButton({
  planId,
  currentUserId,
  members,
  invitations,
  baseUrl,
}: Props) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Tanca amb Esc.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const currentIsOwner =
    members.find((m) => m.userId === currentUserId)?.isOwner ?? false;

  async function handleInvite(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorMsg(null);
    const fd = new FormData(e.currentTarget);
    fd.set("planId", planId);
    startTransition(async () => {
      try {
        await inviteToPlan(fd);
        setEmail("");
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : "Error desconegut.");
      }
    });
  }

  function handleCopy(token: string) {
    const link = `${baseUrl}/invite/${token}`;
    navigator.clipboard.writeText(link);
    setCopied(token);
    setTimeout(() => setCopied(null), 1500);
  }

  function handleCancel(invitationId: string) {
    const fd = new FormData();
    fd.set("planId", planId);
    fd.set("invitationId", invitationId);
    startTransition(async () => {
      await cancelInvitation(fd).catch(() => {});
    });
  }

  function handleRemove(userId: string) {
    if (!window.confirm("Treure aquest membre del pla?")) return;
    const fd = new FormData();
    fd.set("planId", planId);
    fd.set("userId", userId);
    startTransition(async () => {
      try {
        await removeMember(fd);
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : "Error desconegut.");
      }
    });
  }

  function handleLeave() {
    if (
      !window.confirm(
        "Segur que vols sortir d'aquest pla? Perdràs l'accés.",
      )
    ) {
      return;
    }
    const fd = new FormData();
    fd.set("planId", planId);
    startTransition(async () => {
      try {
        await leavePlan(fd);
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : "Error desconegut.");
      }
    });
  }

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setOpen(true)}
        title="Veure i convidar membres"
      >
        <Users className="h-4 w-4" strokeWidth={2} />
        Membres ({members.length})
      </Button>

      {open && (
        <div
          className="fixed inset-0 z-50 bg-ink/40 backdrop-blur-sm flex items-center justify-center px-4 py-8"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-cream w-full max-w-md rounded-2xl shadow-2xl border border-ink-faint/40 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="flex items-center justify-between px-5 py-4 border-b border-ink-faint/40">
              <h2 className="font-serif text-lg font-semibold text-ink">
                Membres del pla
              </h2>
              <button
                onClick={() => setOpen(false)}
                className="text-ink-soft hover:text-ink"
                aria-label="Tancar"
              >
                <X className="h-5 w-5" strokeWidth={2} />
              </button>
            </header>

            <div className="px-5 py-4 space-y-5">
              {/* Llista de membres */}
              <section>
                <h3 className="text-xs uppercase tracking-wide text-ink-soft mb-2">
                  Qui té accés
                </h3>
                <ul className="space-y-2">
                  {members.map((m) => (
                    <li
                      key={m.userId}
                      className="flex items-center justify-between gap-3 text-sm"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-ink">{m.email}</p>
                        {m.isOwner && (
                          <p className="text-xs text-peach-deep">Creador</p>
                        )}
                      </div>
                      {m.userId === currentUserId && !m.isOwner && (
                        <button
                          onClick={handleLeave}
                          disabled={isPending}
                          className="text-xs text-ink-soft hover:text-peach-deep flex items-center gap-1"
                        >
                          <LogOut className="h-3.5 w-3.5" strokeWidth={2} />
                          Sortir
                        </button>
                      )}
                      {m.userId !== currentUserId && currentIsOwner && (
                        <button
                          onClick={() => handleRemove(m.userId)}
                          disabled={isPending}
                          className="text-xs text-ink-soft hover:text-peach-deep flex items-center gap-1"
                          title="Treure d'aquest pla"
                        >
                          <UserMinus className="h-3.5 w-3.5" strokeWidth={2} />
                          Treure
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </section>

              {/* Invitations pendents */}
              {invitations.length > 0 && (
                <section>
                  <h3 className="text-xs uppercase tracking-wide text-ink-soft mb-2">
                    Invitacions pendents
                  </h3>
                  <ul className="space-y-2">
                    {invitations.map((inv) => (
                      <li
                        key={inv.id}
                        className="flex items-center justify-between gap-3 text-sm rounded-md bg-cream-soft/60 px-3 py-2"
                      >
                        <span className="truncate text-ink min-w-0 flex-1">
                          {inv.email}
                        </span>
                        <button
                          onClick={() => handleCopy(inv.token)}
                          disabled={isPending}
                          className="text-xs text-ink-soft hover:text-peach-deep flex items-center gap-1 shrink-0"
                          title="Copiar enllaç d'invitació"
                        >
                          {copied === inv.token ? (
                            <>
                              <Check className="h-3.5 w-3.5" strokeWidth={2} />
                              Copiat
                            </>
                          ) : (
                            <>
                              <Copy className="h-3.5 w-3.5" strokeWidth={2} />
                              Copiar link
                            </>
                          )}
                        </button>
                        <button
                          onClick={() => handleCancel(inv.id)}
                          disabled={isPending}
                          className="text-xs text-ink-soft hover:text-peach-deep shrink-0"
                          title="Cancel·lar invitació"
                        >
                          <X className="h-3.5 w-3.5" strokeWidth={2} />
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {/* Formulari convidar */}
              <section>
                <h3 className="text-xs uppercase tracking-wide text-ink-soft mb-2">
                  Convidar algú per email
                </h3>
                <form onSubmit={handleInvite} className="flex gap-2">
                  <input
                    type="email"
                    required
                    name="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="email@exemple.com"
                    disabled={isPending}
                    className="flex-1 h-10 px-3 rounded-md bg-cream-soft border border-ink-faint/50 text-ink text-sm placeholder:text-ink-soft/70 focus:outline-none focus:border-peach focus:ring-2 focus:ring-peach/15"
                  />
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    disabled={isPending || !email}
                  >
                    {isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />
                    ) : (
                      "Convidar"
                    )}
                  </Button>
                </form>
                <p className="text-xs text-ink-soft mt-2">
                  Es generarà un enllaç. L'envies tu (WhatsApp, email...) i la
                  persona el clica per acceptar. Expira en 7 dies.
                </p>
              </section>

              {errorMsg && (
                <div className="rounded-md border border-peach-deep/40 bg-peach-soft/40 px-3 py-2 text-sm text-ink">
                  {errorMsg}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
