"use client";

import { useRef } from "react";
import Link from "next/link";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { STATUS_LABELS_CA, TYPE_LABELS_CA } from "@/lib/format";
import type { Plan } from "@/lib/types";

export function CoverHero({ plan, dateRange }: { plan: Plan; dateRange?: string }) {
  const ref = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });
  // Parallax molt subtil: el background es mou un 12% més lent que el scroll.
  const bgY = useTransform(scrollYProgress, [0, 1], ["0%", reduce ? "0%" : "12%"]);

  // Tornar al diari o a l'arxiu segons d'on viu el plan.
  const backHref = plan.status === "archived" ? "/archive" : "/";
  const backLabel = plan.status === "archived" ? "l'arxiu" : "tots els plans";

  return (
    <section
      ref={ref}
      className="relative h-[44vh] min-h-[320px] max-h-[480px] flex items-end overflow-hidden"
    >
      <motion.div
        aria-hidden
        className="absolute inset-0 bg-cover bg-center"
        style={{
          background: plan.coverImageUrl
            ? `url("${plan.coverImageUrl}") center / cover no-repeat`
            : plan.cover,
          y: bgY,
        }}
      />
      {/* Overlay: fort a baix per llegir text, més suau al mig per no veure'l "fosc". */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/20 to-transparent" />
      <div className="relative mx-auto max-w-6xl px-6 pb-8 sm:pb-10 w-full text-white">
        <Link
          href={backHref}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-white/90 hover:text-white mb-5 transition-colors [text-shadow:_0_1px_3px_rgba(0,0,0,0.7)]"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={2} />
          {backLabel}
        </Link>
        <div className="flex flex-wrap gap-2 mb-4">
          <Badge variant="glass">{TYPE_LABELS_CA[plan.type]}</Badge>
          {plan.status !== "planning" && (
            <Badge variant="glass">{STATUS_LABELS_CA[plan.status]}</Badge>
          )}
        </div>
        {/* Títol com a chip de vidre fosc — mateix llenguatge que els badges de dalt.
            Inline-block: el chip s'ajusta a l'amplada del text (i envolta totes les línies si wrap). */}
        <h1 className="inline-block max-w-3xl bg-black/45 backdrop-blur-md border border-white/20 rounded-2xl px-5 py-3 font-serif text-3xl sm:text-4xl md:text-6xl font-semibold leading-[1.05] text-white">
          {plan.title}
        </h1>
        {dateRange && (
          <p
            className="font-hand text-2xl mt-3 -rotate-1 inline-block"
            style={{
              textShadow:
                "0 0 6px rgba(255,255,255,0.3), 0 2px 8px rgba(0,0,0,0.5)",
            }}
          >
            {dateRange}
          </p>
        )}
      </div>
    </section>
  );
}
