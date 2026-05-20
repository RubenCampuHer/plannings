"use client";

import { useEffect } from "react";
import { Printer } from "lucide-react";

// Dispara el diàleg "Imprimir / Desar com a PDF" un cop la pàgina s'ha
// renderitzat i les imatges (signed URLs de Supabase) ja s'han carregat.
// Esperem `window.load` perquè algunes impressores guarden la pàgina abans
// que les imatges acabin de baixar si només esperéssim el DOM.
export function AutoPrint() {
  useEffect(() => {
    let cancelled = false;
    function fire() {
      if (cancelled) return;
      // Petit delay perquè el navegador acabi de pintar fonts custom.
      setTimeout(() => {
        if (!cancelled) window.print();
      }, 300);
    }
    if (document.readyState === "complete") {
      fire();
    } else {
      window.addEventListener("load", fire, { once: true });
    }
    return () => {
      cancelled = true;
      window.removeEventListener("load", fire);
    };
  }, []);
  return null;
}

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex items-center gap-1.5 rounded-[var(--radius-button)] bg-peach text-white px-3 py-1.5 font-medium hover:bg-peach-deep transition-colors"
    >
      <Printer className="h-4 w-4" strokeWidth={2} />
      Imprimir / Desar PDF
    </button>
  );
}
