"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { BookOpen, Images, Map, Sparkles } from "lucide-react";

export type Room = "resum" | "mapa" | "album" | "xat";

const META: Record<Room, { label: string; Icon: typeof BookOpen }> = {
  resum: { label: "Resum", Icon: BookOpen },
  mapa: { label: "Mapa", Icon: Map },
  album: { label: "Àlbum", Icon: Images },
  xat: { label: "Copilot", Icon: Sparkles },
};

export function PlanRooms({
  active,
  available,
  placeCount,
  photoCount,
}: {
  active: Room;
  available: Room[];
  placeCount: number;
  photoCount: number;
}) {
  const pathname = usePathname();
  const sp = useSearchParams();

  function hrefFor(room: Room): string {
    const params = new URLSearchParams(sp.toString());
    if (room === "resum") params.delete("v");
    else params.set("v", room);
    const q = params.toString();
    return q ? `${pathname}?${q}` : pathname;
  }

  return (
    <nav aria-label="Vista del plan" className="flex items-center gap-6 text-sm">
      {available.map((room) => {
        const { label, Icon } = META[room];
        const isActive = room === active;
        const count =
          room === "mapa" ? placeCount : room === "album" ? photoCount : null;
        return (
          <Link
            key={room}
            href={hrefFor(room)}
            aria-current={isActive ? "page" : undefined}
            className={`flex items-center gap-2 py-3 border-b-2 transition-colors ${
              isActive
                ? "border-peach text-ink font-medium"
                : "border-transparent text-ink-soft hover:text-ink hover:border-ink-faint/50"
            }`}
          >
            <Icon className="h-4 w-4" strokeWidth={2} />
            <span>{label}</span>
            {count !== null && (
              <span
                className={`text-xs tabular-nums ${
                  isActive ? "text-peach-deep" : "text-ink-soft/80"
                }`}
              >
                · {count}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
