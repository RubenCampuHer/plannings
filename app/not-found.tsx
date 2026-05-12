import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-24 md:py-32 text-center">
      <p className="font-hand text-2xl text-peach-deep -rotate-2 inline-block mb-3">
        ai…
      </p>
      <h1 className="font-serif text-5xl md:text-6xl font-semibold text-ink leading-tight">
        Aquí no hi ha cap plan
      </h1>
      <p className="mt-5 text-base md:text-lg text-ink-soft leading-relaxed max-w-md mx-auto">
        Potser l&apos;has arxivat, potser no existeix encara, o potser
        l&apos;adreça no és del tot correcta.
      </p>
      <div className="mt-8 flex items-center justify-center gap-3">
        <Link href="/">
          <Button variant="primary">Tornar al diari</Button>
        </Link>
        <Link href="/archive">
          <Button variant="outline">Mirar l&apos;arxiu</Button>
        </Link>
      </div>
    </div>
  );
}
