export type TocHeading = { id: string; text: string };

// Slug determinista i Unicode-aware (suporta accents catalans/castellans/portuguesos).
export function slugify(text: string): string {
  const base = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // diacrítics combinats
    .replace(/[^a-z0-9\s-]/g, " ")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
  return base || "section";
}

// Slugger amb estat per gestionar duplicats: "Dia 1" + "Dia 1" → "dia-1", "dia-1-2".
// Cal cridar makeSlugger() de nou per cada render del document perquè el comptador
// es reseti — sluggers de l'extractor i del renderitzador han de viure el mateix temps.
export function makeSlugger(): (text: string) => string {
  const seen = new Map<string, number>();
  return (text) => {
    const base = slugify(text);
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    return count === 0 ? base : `${base}-${count + 1}`;
  };
}

// Elimina sintaxi inline de Markdown perquè el text del TOC sigui llegible.
function stripInlineMarkdown(text: string): string {
  return text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // [text](url) → text
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1") // ![alt](url) → alt
    .replace(/`([^`]+)`/g, "$1") // `code` → code
    .replace(/\*\*([^*]+)\*\*/g, "$1") // **bold**
    .replace(/__([^_]+)__/g, "$1") // __bold__
    .replace(/\*([^*]+)\*/g, "$1") // *italic*
    .replace(/_([^_]+)_/g, "$1") // _italic_
    .replace(/~~([^~]+)~~/g, "$1") // ~~strike~~
    .trim();
}

export function extractH2Headings(markdown: string): TocHeading[] {
  const lines = markdown.split("\n");
  const slugger = makeSlugger();
  const result: TocHeading[] = [];
  let inFence = false;

  for (const line of lines) {
    // Saltem el contingut dins de code fences ``` perquè un `## ` allà no és heading.
    if (/^\s*```/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;

    // ATX H2 exactament: `## Text` (no `###`). Permet `## Text ##` opcional al final.
    const m = /^##[ \t]+(.+?)(?:[ \t]+#+)?[ \t]*$/.exec(line);
    if (!m) continue;

    const text = stripInlineMarkdown(m[1]);
    if (!text) continue;
    result.push({ id: slugger(text), text });
  }

  return result;
}
