import { FileText, FileType } from "lucide-react";
import { formatDate } from "@/lib/format";
import type { PlanDocument } from "@/lib/types";
import { CollapsibleCard } from "./collapsible-card";

function iconFor(mime: string) {
  if (mime.includes("pdf")) return FileType;
  return FileText;
}

export function DocumentList({ documents }: { documents: PlanDocument[] }) {
  if (documents.length === 0) return null;

  return (
    <CollapsibleCard
      title="Documents"
      defaultCollapsed={documents.length > 4}
      summary={
        <span className="text-xs text-ink-soft tabular-nums">
          {documents.length}
        </span>
      }
    >
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
    </CollapsibleCard>
  );
}
