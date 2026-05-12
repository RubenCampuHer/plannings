import { cn } from "@/lib/utils";

type Variant = "peach" | "sage" | "dusty" | "cream" | "ink";

const VARIANTS: Record<Variant, string> = {
  peach: "bg-peach/20 text-peach-deep border-peach/30",
  sage: "bg-sage/25 text-sage-deep border-sage/40",
  dusty: "bg-dusty/25 text-dusty-deep border-dusty/40",
  cream: "bg-cream/95 text-ink border-ink-faint/40",
  ink: "bg-ink/90 text-cream border-ink/90",
};

export function Badge({
  variant = "cream",
  className,
  children,
}: {
  variant?: Variant;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium tracking-wide uppercase border",
        VARIANTS[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}
