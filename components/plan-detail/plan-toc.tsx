"use client";

import { useEffect, useState } from "react";
import type { TocHeading } from "@/lib/toc";

export function PlanToc({ headings }: { headings: TocHeading[] }) {
  const [activeId, setActiveId] = useState<string | null>(
    headings[0]?.id ?? null,
  );

  useEffect(() => {
    if (headings.length === 0) return;

    const elements = headings
      .map((h) => document.getElementById(h.id))
      .filter((el): el is HTMLElement => el !== null);
    if (elements.length === 0) return;

    // rootMargin top -80px deixa marge per al header; bottom -60% fa que una secció
    // es consideri "activa" quan ja ha entrat al terç superior del viewport.
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible.length > 0) {
          setActiveId(visible[0].target.id);
        }
      },
      { rootMargin: "-80px 0px -60% 0px", threshold: 0 },
    );

    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [headings]);

  function handleClick(e: React.MouseEvent<HTMLAnchorElement>, id: string) {
    e.preventDefault();
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    // Hash a la URL sense provocar un altre scroll (history > location).
    history.replaceState(null, "", `#${id}`);
    setActiveId(id);
  }

  return (
    <nav aria-label="Sumari del plan" className="px-1">
      <h2 className="font-hand text-xl text-peach-deep -rotate-1 inline-block mb-2">
        sumari
      </h2>
      <ul className="space-y-0.5 text-sm">
        {headings.map((h) => {
          const active = h.id === activeId;
          return (
            <li key={h.id}>
              <a
                href={`#${h.id}`}
                onClick={(e) => handleClick(e, h.id)}
                aria-current={active ? "location" : undefined}
                className={`block py-1 pl-3 -ml-px border-l-2 transition-colors ${
                  active
                    ? "border-peach text-ink font-medium"
                    : "border-ink-faint/25 text-ink-soft hover:text-ink hover:border-ink-faint/60"
                }`}
              >
                {h.text}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
