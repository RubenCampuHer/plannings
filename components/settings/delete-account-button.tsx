"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { deleteAccount } from "@/lib/account-actions";

export function DeleteAccountButton() {
  const [confirming, setConfirming] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    if (text.trim().toUpperCase() !== "ESBORRAR") {
      setError("Escriu ESBORRAR en majúscules per confirmar.");
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await deleteAccount();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error desconegut.");
      }
    });
  }

  if (!confirming) {
    return (
      <Button
        variant="outline"
        onClick={() => setConfirming(true)}
        className="text-peach-deep border-peach-deep/50 hover:bg-peach-soft/60"
      >
        <Trash2 className="h-4 w-4" strokeWidth={2} />
        Esborrar el meu compte
      </Button>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-sm text-ink">
        Escriu <strong>ESBORRAR</strong> per confirmar.
      </p>
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        disabled={isPending}
        autoFocus
        className="w-full h-10 px-3 rounded-md bg-cream border border-peach-deep/50 text-ink text-sm focus:outline-none focus:ring-2 focus:ring-peach/30"
      />
      {error && (
        <p className="text-xs text-peach-deep">{error}</p>
      )}
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setConfirming(false);
            setText("");
            setError(null);
          }}
          disabled={isPending}
        >
          Cancel·lar
        </Button>
        <Button
          variant="primary"
          size="sm"
          onClick={handleDelete}
          disabled={isPending}
          className="!bg-peach-deep hover:!bg-peach"
        >
          {isPending ? "Esborrant…" : "Sí, esborrar definitivament"}
        </Button>
      </div>
    </div>
  );
}
