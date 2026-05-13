import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { WordImportFlow } from "@/components/plan-detail/word-import-flow";

export const metadata: Metadata = {
  title: "Importar Word · Plannings",
};

export const dynamic = "force-dynamic";

export default function ImportWordPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-10 md:py-14">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm text-ink-soft hover:text-ink mb-6"
      >
        <ChevronLeft className="h-4 w-4" strokeWidth={2} />
        Tornar
      </Link>

      <p className="font-hand text-2xl text-peach-deep mb-2 -rotate-1 inline-block">
        des d&apos;un document
      </p>
      <h1 className="font-serif text-3xl md:text-4xl font-semibold text-ink mb-2">
        Importar un plan des de Word
      </h1>
      <p className="text-ink-soft mb-10 leading-relaxed">
        Puja un <code className="font-mono text-sm">.docx</code> i Gemini llegirà
        el contingut, decidirà si és un sol plan o un viatge amb sub-plans per
        país i et proposarà l&apos;estructura. Tu confirmes abans que es creï res.
      </p>

      <WordImportFlow />
    </div>
  );
}
