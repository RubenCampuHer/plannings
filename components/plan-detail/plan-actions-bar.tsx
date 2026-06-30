"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Archive, ArchiveRestore, Pencil, Share2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { archivePlan, deletePlan, unarchivePlan } from "@/lib/plan-actions";

type Props = {
  planId: string;
  planTitle: string;
  isArchived: boolean;
  /** Botó "Membres" injectat des del servidor (necessita auth + data). */
  membersSlot?: React.ReactNode;
};

export function PlanActionsBar({
  planId,
  planTitle,
  isArchived,
  membersSlot,
}: Props) {
  const [isPending, startTransition] = useTransition();
  const [confirmingDelete, setConfirmingDelete] = useState(false);

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
    startTransition(async () => {
      await deletePlan(planId);
    });
  }

  // Al mòbil ocupa tota l'amplada i els botons queden a sota de la info strip;
  // a sm+ es queda alineat a la dreta com abans.
  return (
    <span className="w-full sm:w-auto sm:ml-auto flex flex-wrap items-center gap-2 mt-1 sm:mt-0">
      {membersSlot}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setConfirmingDelete(true)}
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

      <ConfirmDialog
        open={confirmingDelete}
        title={`Esborrar "${planTitle}"?`}
        description="Esborrarà també tots els llocs, checklist, despeses, fotos i documents associats. No es pot desfer."
        confirmLabel="Esborrar per sempre"
        destructive
        busy={isPending}
        onConfirm={handleDelete}
        onCancel={() => setConfirmingDelete(false)}
      />
    </span>
  );
}
