import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import type { PlanRef } from "@/lib/types";

export function PlanBreadcrumb({ parent }: { parent: PlanRef }) {
  return (
    <div className="mx-auto max-w-6xl px-6 pt-6 pb-2">
      <Link
        href={`/plans/${parent.id}`}
        className="inline-flex items-center gap-1.5 text-sm text-ink-soft hover:text-ink transition-colors"
      >
        <ChevronLeft className="h-4 w-4" strokeWidth={2} />
        <span className="truncate">{parent.title}</span>
      </Link>
    </div>
  );
}
