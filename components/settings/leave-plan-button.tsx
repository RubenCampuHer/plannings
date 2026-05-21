"use client";

import { useTransition } from "react";
import { LogOut } from "lucide-react";
import { leavePlan } from "@/lib/invitation-actions";

export function LeavePlanButton({
  planId,
  planTitle,
}: {
  planId: string;
  planTitle: string;
}) {
  const [isPending, startTransition] = useTransition();

  function handle() {
    if (!window.confirm(`Sortir del pla "${planTitle}"?`)) return;
    const fd = new FormData();
    fd.set("planId", planId);
    startTransition(async () => {
      await leavePlan(fd).catch(() => {});
    });
  }

  return (
    <button
      onClick={handle}
      disabled={isPending}
      className="text-xs text-ink-soft hover:text-peach-deep flex items-center gap-1 shrink-0"
    >
      <LogOut className="h-3.5 w-3.5" strokeWidth={2} />
      Sortir
    </button>
  );
}
