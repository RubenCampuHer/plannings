export type TocHeading = { id: string; text: string; level?: 2 | 3 };

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
  return extractHeadings(markdown, [2]);
}

/**
 * Extreu headings del markdown (H2, H3, o ambdós) en ordre del document.
 * Slugger compartit entre tots dos nivells — el slug és únic globalment, en
 * el mateix ordre que la renderització fa al MarkdownBody, perquè els ids
 * coincideixin amb els que afegeix el slugger del renderer.
 */
export function extractHeadings(
  markdown: string,
  levels: (2 | 3)[] = [2],
): TocHeading[] {
  const lines = markdown.split("\n");
  const slugger = makeSlugger();
  const result: TocHeading[] = [];
  let inFence = false;

  const wantH2 = levels.includes(2);
  const wantH3 = levels.includes(3);

  for (const line of lines) {
    if (/^\s*```/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;

    // H3 abans que H2 perquè la regex de H2 és prefix de H3.
    const h3 = wantH3
      ? /^###[ \t]+(.+?)(?:[ \t]+#+)?[ \t]*$/.exec(line)
      : null;
    if (h3) {
      const text = stripInlineMarkdown(h3[1]);
      if (text) result.push({ id: slugger(text), text, level: 3 });
      continue;
    }

    const h2 = wantH2
      ? /^##[ \t]+(.+?)(?:[ \t]+#+)?[ \t]*$/.exec(line)
      : null;
    if (h2) {
      const text = stripInlineMarkdown(h2[1]);
      if (text) result.push({ id: slugger(text), text, level: 2 });
    }
  }

  return result;
}
