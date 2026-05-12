import { FileText, FileType } from "lucide-react";
import { formatDate } from "@/lib/format";
import type { PlanDocument } from "@/lib/types";

function iconFor(mime: string) {
  if (mime.includes("pdf")) return FileType;
  return FileText;
}

export function DocumentList({ documents }: { documents: PlanDocument[] }) {
  if (documents.length === 0) return null;

  return (
    <section className="rounded-[var(--radius-card)] bg-cream-soft/70 border border-ink-faint/30 p-6">
      <h2 className="font-serif text-lg font-semibold mb-4">Documents</h2>
      <ul className="space-y-2">
        {documents.map((doc) => {
          const Icon = iconFor(doc.mimeType);
          return (
            <li key={doc.id} className="flex items-center gap-3 text-sm">
              <span className="grid place-items-center h-9 w-9 rounded-lg bg-cream border border-ink-faint/50 text-ink-soft">
                <Icon className="h-4 w-4" strokeWidth={1.75} />
              </span>
              <span className="flex-1 min-w-0">
                <span className="block truncate text-ink">{doc.filename}</span>
                <span className="block text-xs text-ink-soft">
                  pujat {formatDate(doc.uploadedAt)}
                  {doc.sizeKb && ` · ${doc.sizeKb} KB`}
                </span>
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
