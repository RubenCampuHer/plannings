"use client";

import { useRef } from "react";
import Link from "next/link";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { STATUS_LABELS_CA, TYPE_LABELS_CA } from "@/lib/format";
import type { Plan } from "@/lib/types";

const TYPE_TONE = {
  deep: "peach",
  weekend: "dusty",
  day: "sage",
} as const;

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
        className="absolute inset-0"
        style={{ background: plan.cover, y: bgY }}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-black/15 to-transparent" />
      <div className="relative mx-auto max-w-6xl px-6 pb-8 sm:pb-10 w-full text-white">
        <Link
          href={backHref}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-white/85 hover:text-white mb-5 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={2} />
          {backLabel}
        </Link>
        <div className="flex flex-wrap gap-2 mb-4">
          <Badge variant={TYPE_TONE[plan.type]}>{TYPE_LABELS_CA[plan.type]}</Badge>
          {plan.status !== "planning" && (
            <Badge variant="ink">{STATUS_LABELS_CA[plan.status]}</Badge>
          )}
        </div>
        <h1 className="font-serif text-3xl sm:text-4xl md:text-6xl font-semibold leading-[1.05] max-w-3xl drop-shadow-[0_2px_8px_rgba(0,0,0,0.25)]">
          {plan.title}
        </h1>
        {dateRange && (
          <p className="font-hand text-2xl mt-3 -rotate-1 inline-block drop-shadow-[0_1px_4px_rgba(0,0,0,0.3)]">
            {dateRange}
          </p>
        )}
      </div>
    </section>
  );
}
