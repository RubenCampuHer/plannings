"use client";

import { cn } from "@/lib/utils";

export function Chip({
  active,
  onClick,
  children,
  tone = "peach",
}: {
  active?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
  tone?: "peach" | "sage" | "dusty";
}) {
  const tones = {
    peach: active
      ? "bg-peach text-white border-peach shadow-[0_2px_0_0_rgba(226,122,69,0.25)]"
      : "border-ink-faint/60 text-ink-soft hover:bg-peach-soft/40 hover:text-ink hover:border-peach/40",
    sage: active
      ? "bg-sage-deep text-white border-sage-deep"
      : "border-ink-faint/60 text-ink-soft hover:bg-sage-soft/40 hover:text-ink",
    dusty: active
      ? "bg-dusty-deep text-white border-dusty-deep"
      : "border-ink-faint/60 text-ink-soft hover:bg-dusty-soft/40 hover:text-ink",
  } as const;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "h-9 px-4 rounded-full border text-sm font-medium transition-all duration-200 select-none",
        tones[tone],
      )}
    >
      {children}
    </button>
  );
}
