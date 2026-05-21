import Link from "next/link";
import { LogOut, Settings } from "lucide-react";
import { signOut } from "@/lib/auth-actions";

export function UserMenu({ email }: { email: string }) {
  const initial = email[0]?.toUpperCase() ?? "?";

  return (
    <details className="relative ml-1">
      <summary
        className="list-none cursor-pointer rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-peach/40 focus-visible:ring-offset-2 focus-visible:ring-offset-cream transition-transform hover:scale-105"
        aria-label={`Sessió de ${email}`}
      >
        <span className="grid place-items-center h-9 w-9 rounded-full bg-sage-deep text-white text-sm font-medium shadow-[0_2px_0_0_rgba(123,151,113,0.25)]">
          {initial}
        </span>
      </summary>
      <div className="absolute right-0 mt-2 w-64 rounded-lg border border-ink-faint/40 bg-cream-soft shadow-[0_8px_24px_-8px_rgba(58,46,42,0.18)] p-3 z-50">
        <p className="text-[10px] uppercase tracking-wider text-ink-soft mb-1">
          Connectat com
        </p>
        <p className="text-sm font-medium text-ink truncate mb-3">{email}</p>
        <Link
          href="/settings"
          className="w-full inline-flex items-center gap-2 px-3 py-2 rounded-md text-sm text-ink hover:bg-cream-deep/60 transition-colors"
        >
          <Settings className="h-4 w-4" strokeWidth={2} />
          Configuració
        </Link>
        <form action={signOut}>
          <button
            type="submit"
            className="w-full inline-flex items-center gap-2 px-3 py-2 rounded-md text-sm text-ink hover:bg-cream-deep/60 transition-colors"
          >
            <LogOut className="h-4 w-4" strokeWidth={2} />
            Sortir
          </button>
        </form>
      </div>
    </details>
  );
}
