import type { ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { createSupabaseServer } from "@/lib/supabase-server";
import { makeSlugger } from "@/lib/toc";

function extractText(children: ReactNode): string {
  if (typeof children === "string") return children;
  if (typeof children === "number") return String(children);
  if (Array.isArray(children)) return children.map(extractText).join("");
  if (children && typeof children === "object" && "props" in children) {
    const p = (children as { props?: { children?: ReactNode } }).props;
    return p ? extractText(p.children) : "";
  }
  return "";
}

// Detecta items "Camp:" o "Camp?:" sense valor — fills dels day templates
// que l'usuari encara no ha omplert. Permet lletres unicode, dígits, espais,
// apòstrofs i puntuació suau (per "Distància aprox.:", "Punt d'inici:", etc).
const STUB_FIELD_RE = /^[\p{L}][\p{L}\p{N}\s.,'·-]*\??:\s*$/u;

// Detecta referències `pp:plan-id/path.jpg` dins de la sintaxi de imatge markdown.
// Es resolen a signed URLs a render time. Limitació coneguda: si l'usuari escriu
// `pp:...` dins d'un code block, també es substitueix — no és greu però val la pena saber-ho.
const INLINE_IMAGE_RE = /!\[([^\]]*)\]\(pp:([^)\s]+)\)/g;

async function substituteInlineImages(body: string): Promise<string> {
  const paths = new Set<string>();
  for (const m of body.matchAll(INLINE_IMAGE_RE)) {
    paths.add(m[2]);
  }
  if (paths.size === 0) return body;

  const supabase = await createSupabaseServer();
  const { data: signed } = await supabase.storage
    .from("plan-photos")
    .createSignedUrls(Array.from(paths), 60 * 60);

  const urlByPath = new Map<string, string>();
  for (const s of signed ?? []) {
    if (s.signedUrl && s.path) urlByPath.set(s.path, s.signedUrl);
  }

  return body.replace(INLINE_IMAGE_RE, (_match, alt, path) => {
    const url = urlByPath.get(path);
    return url ? `![${alt}](${url})` : `*[imatge no disponible: ${path}]*`;
  });
}

export async function MarkdownBody({ children }: { children: string }) {
  // Slugger nou per cada render. Ha de produir els mateixos slugs que
  // `extractH2Headings(plan.body)` perquè els ancles del TOC funcionin.
  const slugger = makeSlugger();
  const body = await substituteInlineImages(children);

  return (
    <div className="prose-warm max-w-none">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h2: ({ children, className }) => (
            <h2 id={slugger(extractText(children))} className={className}>
              {children}
            </h2>
          ),
          // H3 també rep id slug perquè el copilot pugui enllaçar a sub-seccions
          // específiques (#vols, #allotjament, etc.) i no només a l'H2 pare.
          h3: ({ children, className }) => (
            <h3 id={slugger(extractText(children))} className={className}>
              {children}
            </h3>
          ),
          li: ({ children, className }) => {
            const isStub = STUB_FIELD_RE.test(extractText(children).trim());
            return (
              <li
                className={
                  isStub
                    ? `${className ?? ""} text-ink-soft/50 italic`
                    : className
                }
              >
                {children}
              </li>
            );
          },
          img: ({ src, alt }) => {
            const url = typeof src === "string" ? src : undefined;
            const caption = alt?.trim();
            // Usem <span> en comptes de <figure> perquè les imatges Markdown
            // estan dins d'un <p> automàtic — <figure> dins <p> seria HTML
            // invàlid. `display: block` ens dóna el layout visual de figure.
            return (
              <span className="block my-8">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt={caption ?? ""}
                  loading="lazy"
                  className="block w-full h-auto rounded-[var(--radius-card)] border border-ink-faint/30 shadow-[0_10px_30px_-12px_rgba(58,46,42,0.25)]"
                />
                {caption && (
                  <span className="block font-hand text-base text-ink-soft text-center mt-3 -rotate-[0.6deg]">
                    {caption}
                  </span>
                )}
              </span>
            );
          },
        }}
      >
        {body}
      </ReactMarkdown>
    </div>
  );
}
