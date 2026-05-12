"use client";

import Link from "next/link";
import { useTransition } from "react";
import { Archive, ArchiveRestore, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { archivePlan, deletePlan, unarchivePlan } from "@/lib/plan-actions";

type Props = {
  planId: string;
  planTitle: string;
  isArchived: boolean;
};

export function PlanActionsBar({ planId, planTitle, isArchived }: Props) {
  const [isPending, startTransition] = useTransition();

  function handleArchive() {
    startTransition(async () => {
      if (isArchived) {
        await unarchivePlan(planId);
      } else {
        await archivePlan(planId);
      }
    });
  }

  function handleDelete() {
    const ok = window.confirm(
      `Segur que vols esborrar "${planTitle}"?\n\nAixò esborrarà també tots els llocs, checklist, despeses, fotos i documents associats. No es pot desfer.`,
    );
    if (!ok) return;
    startTransition(async () => {
      await deletePlan(planId);
    });
  }

  return (
    <span className="ml-auto hidden sm:flex items-center gap-2">
      <Button
        variant="ghost"
        size="sm"
        onClick={handleDelete}
        disabled={isPending}
        title="Esborrar aquest plan per sempre"
      >
        <Trash2 className="h-4 w-4" strokeWidth={2} />
        Esborrar
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={handleArchive}
        disabled={isPending}
        title={isArchived ? "Treure de l'arxiu" : "Moure a l'arxiu"}
      >
        {isArchived ? (
          <>
            <ArchiveRestore className="h-4 w-4" strokeWidth={2} />
            Desarxivar
          </>
        ) : (
          <>
            <Archive className="h-4 w-4" strokeWidth={2} />
            Arxivar
          </>
        )}
      </Button>
      <Link href={`/plans/${planId}/edit`}>
        <Button variant="primary" size="sm" disabled={isPending}>
          <Pencil className="h-4 w-4" strokeWidth={2} />
          Editar
        </Button>
      </Link>
    </span>
  );
}
