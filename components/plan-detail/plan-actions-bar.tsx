"use client";

import Link from "next/link";
import { useTransition } from "react";
import { Archive, ArchiveRestore, Pencil, Share2, Trash2 } from "lucide-react";
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

  // Al mòbil ocupa tota l'amplada i els botons queden a sota de la info strip;
  // a sm+ es queda alineat a la dreta com abans.
  return (
    <span className="w-full sm:w-auto sm:ml-auto flex flex-wrap items-center gap-2 mt-1 sm:mt-0">
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
      <Link
        href={`/plans/${planId}/print?auto=0`}
        target="_blank"
        rel="noopener"
        title="Obrir vista per imprimir / desar com a PDF per compartir"
      >
        <Button variant="ghost" size="sm" disabled={isPending}>
          <Share2 className="h-4 w-4" strokeWidth={2} />
          Compartir
        </Button>
      </Link>
      <Link href={`/plans/${planId}/edit`}>
        <Button variant="primary" size="sm" disabled={isPending}>
          <Pencil className="h-4 w-4" strokeWidth={2} />
          Editar
        </Button>
      </Link>
    </span>
  );
}
