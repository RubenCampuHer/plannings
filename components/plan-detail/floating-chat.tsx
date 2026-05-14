"use client";

import { useEffect, useRef, useState } from "react";
import { GripHorizontal, Sparkles, X } from "lucide-react";
import { PlanChat } from "./plan-chat";

const PANEL_W = 400;
const PANEL_H = 600;
const POS_KEY = "plannings:copilot-pos";
const MOBILE_BREAKPOINT = 640;

type Pos = { x: number; y: number };

function defaultPos(): Pos {
  if (typeof window === "undefined") return { x: 0, y: 0 };
  return {
    x: window.innerWidth - PANEL_W - 24,
    y: Math.max(24, window.innerHeight - PANEL_H - 24),
  };
}

function constrain(p: Pos): Pos {
  if (typeof window === "undefined") return p;
  // Deixem com a mínim 100px del header visible perquè l'usuari pugui tornar
  // a arrossegar-lo o tancar-lo si ho ha enviat fora de pantalla.
  return {
    x: Math.max(-(PANEL_W - 120), Math.min(window.innerWidth - 120, p.x)),
    y: Math.max(0, Math.min(window.innerHeight - 48, p.y)),
  };
}

/**
 * Wrapper del copilot que viu flotant sobre la pàgina del plan. FAB peach
 * sempre visible (bottom-right). Al click obre un panell de 400x600 al desktop
 * que es pot arrossegar pel handle del header; la posició es persisteix a
 * localStorage. Al mòbil mostra un bottom sheet quasi-fullscreen sense drag.
 */
export function FloatingChat({
  planId,
  planTitle,
}: {
  planId: string;
  planTitle: string;
}) {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<Pos>({ x: 0, y: 0 });
  const [isMobile, setIsMobile] = useState(false);
  const draggingRef = useRef(false);
  const dragStartRef = useRef<{ mouse: Pos; pos: Pos } | null>(null);

  // Inicialització: mount + restaurar posició + detectar mobile.
  useEffect(() => {
    setMounted(true);
    const mobile = window.innerWidth < MOBILE_BREAKPOINT;
    setIsMobile(mobile);
    if (!mobile) {
      try {
        const saved = localStorage.getItem(POS_KEY);
        if (saved) {
          const p = JSON.parse(saved);
          if (typeof p?.x === "number" && typeof p?.y === "number") {
            setPos(constrain(p));
            return;
          }
        }
      } catch {
        // localStorage pot fallar en privat mode; caiem al default.
      }
      setPos(defaultPos());
    }
  }, []);

  // Resize: re-detecta mobile + re-constreny posició.
  useEffect(() => {
    function onResize() {
      const mobile = window.innerWidth < MOBILE_BREAKPOINT;
      setIsMobile(mobile);
      if (!mobile) setPos((p) => constrain(p));
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Persisteix la posició a localStorage (només desktop).
  useEffect(() => {
    if (!mounted || isMobile) return;
    try {
      localStorage.setItem(POS_KEY, JSON.stringify(pos));
    } catch {
      // ignorat
    }
  }, [pos, mounted, isMobile]);

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (isMobile) return;
    // Només si premem amb el botó principal del ratolí / dit.
    if (e.button !== 0 && e.pointerType === "mouse") return;
    draggingRef.current = true;
    dragStartRef.current = {
      mouse: { x: e.clientX, y: e.clientY },
      pos: { ...pos },
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!draggingRef.current || !dragStartRef.current) return;
    const dx = e.clientX - dragStartRef.current.mouse.x;
    const dy = e.clientY - dragStartRef.current.mouse.y;
    setPos(
      constrain({
        x: dragStartRef.current.pos.x + dx,
        y: dragStartRef.current.pos.y + dy,
      }),
    );
  }

  function onPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    dragStartRef.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // Si el captureId ja s'ha alliberat (ex. unmount durant drag), ignorem.
    }
  }

  function resetPosition() {
    setPos(defaultPos());
  }

  // No renderitzem fins després de mount per evitar SSR mismatch del FAB i del
  // panell (depenen de window.innerWidth + localStorage).
  if (!mounted) return null;

  // ---------- FAB tancat ----------
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Obrir Copilot"
        title="Pregunta a la IA sobre aquest plan"
        className="fixed bottom-6 right-6 z-40 grid place-items-center h-14 w-14 rounded-full bg-peach text-white shadow-[0_8px_24px_-8px_rgba(226,122,69,0.6)] hover:bg-peach-deep hover:scale-105 active:scale-95 transition-all"
      >
        <Sparkles className="h-6 w-6" strokeWidth={2.25} />
      </button>
    );
  }

  // ---------- Mode mòbil: bottom sheet ----------
  if (isMobile) {
    return (
      <div className="fixed inset-x-0 bottom-0 top-16 z-40 bg-cream rounded-t-2xl shadow-[0_-12px_40px_-12px_rgba(58,46,42,0.4)] border-t border-x border-ink-faint/40 flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-200">
        <div className="flex items-center justify-between px-4 py-3 border-b border-ink-faint/30 shrink-0 bg-cream-soft/60">
          <div className="flex items-center gap-2 font-medium text-sm">
            <Sparkles className="h-4 w-4 text-peach-deep" strokeWidth={2.25} />
            Copilot
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Tancar"
            className="p-1 -m-1 text-ink-soft hover:text-ink"
          >
            <X className="h-5 w-5" strokeWidth={2} />
          </button>
        </div>
        <div className="flex-1 min-h-0 px-4 pt-3 pb-4 flex flex-col">
          <PlanChat planId={planId} planTitle={planTitle} />
        </div>
      </div>
    );
  }

  // ---------- Mode desktop: panell flotant arrossegable ----------
  return (
    <div
      className="fixed z-40 bg-cream rounded-2xl shadow-[0_24px_48px_-12px_rgba(58,46,42,0.3)] border border-ink-faint/40 flex flex-col overflow-hidden"
      style={{
        left: `${pos.x}px`,
        top: `${pos.y}px`,
        width: `${PANEL_W}px`,
        height: `${PANEL_H}px`,
      }}
    >
      <div className="flex items-center justify-between border-b border-ink-faint/30 shrink-0 bg-cream-soft/60">
        <div
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onDoubleClick={resetPosition}
          title="Arrossega per moure · doble click per reset"
          className="flex-1 flex items-center gap-2 px-3 py-2.5 cursor-grab active:cursor-grabbing select-none touch-none"
        >
          <GripHorizontal
            className="h-4 w-4 text-ink-soft"
            strokeWidth={2}
          />
          <Sparkles className="h-4 w-4 text-peach-deep" strokeWidth={2.25} />
          <span className="font-medium text-sm">Copilot</span>
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Tancar"
          className="px-3 py-2.5 text-ink-soft hover:text-ink border-l border-ink-faint/30"
        >
          <X className="h-4 w-4" strokeWidth={2} />
        </button>
      </div>
      <div className="flex-1 min-h-0 px-4 pt-3 pb-4 flex flex-col">
        <PlanChat planId={planId} planTitle={planTitle} />
      </div>
    </div>
  );
}
