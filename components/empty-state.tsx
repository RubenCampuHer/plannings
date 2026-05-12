"use client";

import { Button } from "@/components/ui/button";

export function EmptyState({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-20 px-6">
      <svg
        viewBox="0 0 120 90"
        className="w-32 h-24 mb-4 opacity-80"
        aria-hidden
      >
        {/* A simple hand-drawn-feel landscape: hills + sun + path */}
        <defs>
          <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#F8C8A0" />
            <stop offset="100%" stopColor="#FBF7F0" />
          </linearGradient>
        </defs>
        <rect x="0" y="0" width="120" height="90" fill="url(#sky)" rx="8" />
        <circle cx="92" cy="28" r="8" fill="#F4A26E" />
        <path
          d="M0 70 Q 30 50 55 60 T 120 55 L 120 90 L 0 90 Z"
          fill="#A8C4A2"
        />
        <path
          d="M0 80 Q 35 65 70 75 T 120 70 L 120 90 L 0 90 Z"
          fill="#7DA478"
          opacity="0.9"
        />
        <path
          d="M55 90 Q 60 70 70 60"
          fill="none"
          stroke="#3A2E2A"
          strokeWidth="1"
          strokeDasharray="2 3"
          strokeLinecap="round"
        />
      </svg>
      <h2 className="font-serif text-xl text-ink">{title}</h2>
      {subtitle && (
        <p className="text-sm text-ink-soft max-w-sm mt-1.5">{subtitle}</p>
      )}
      {action && (
        <Button variant="outline" size="sm" className="mt-5" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  );
}
