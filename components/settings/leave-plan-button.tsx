"use client";

import { useState, useTransition } from "react";
import { LogOut } from "lucide-react";
import { leavePlan } from "@/lib/invitation-actions";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

export function LeavePlanButton({
  planId,
  planTitle,
}: {
  planId: string;
  planTitle: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);

  function handle() {
    const fd = new FormData();
    fd.set("planId", planId);
    startTransition(async () => {
      await leavePlan(fd).catch(() => {});
      setConfirming(false);
    });
  }

  return (
    <>
      <button
        onClick={() => setConfirming(true)}
        disabled={isPending}
        className="text-xs text-ink-soft hover:text-peach-deep inline-flex items-center gap-1 shrink-0 min-h-[40px] sm:min-h-0"
      >
        <LogOut className="h-3.5 w-3.5" strokeWidth={2} />
        Sortir
      </button>
      <ConfirmDialog
        open={confirming}
        title={`Sortir del pla "${planTitle}"?`}
        description="Deixaràs de veure'l. El propietari pot tornar-te a convidar."
        confirmLabel="Sortir"
        destructive
        busy={isPending}
        onConfirm={handle}
        onCancel={() => setConfirming(false)}
      />
    </>
  );
}
