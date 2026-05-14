"use client";

import Link from "next/link";
import { Fragment, useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { Loader2, Send, Sparkles, Trash2 } from "lucide-react";
import {
  clearChatMessages,
  getChatMessages,
  sendChatMessage,
  type ChatMessage,
} from "@/lib/chat-actions";

/**
 * Sala de xat amb el copilot del plan. MVP read-only: el copilot llegeix tot el
 * context del pla (metadades + llocs + checklist + body) i respon, però no pot
 * modificar res encara. Function calling vindrà a M8.2.
 */
export function PlanChat({
  planId,
  planTitle,
}: {
  planId: string;
  planTitle: string;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [clearing, startClear] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Càrrega inicial de l'historial.
  useEffect(() => {
    let cancelled = false;
    getChatMessages(planId)
      .then((msgs) => {
        if (!cancelled) setMessages(msgs);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [planId]);

  // Auto-scroll cap avall quan arriba un missatge nou.
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length, pending]);

  async function send() {
    const text = input.trim();
    if (!text || pending) return;
    setError(null);

    // Optimistic: afegim el missatge de l'usuari de seguida.
    const tempId = `temp-${crypto.randomUUID()}`;
    const optimisticUser: ChatMessage = {
      id: tempId,
      role: "user",
      content: text,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimisticUser]);
    setInput("");
    setPending(true);

    try {
      const reply = await sendChatMessage(planId, text);
      // Substituïm el temp per la versió definitiva (mateix contingut, id real
      // arriba a `reply` però el user message no, així que tornem a carregar).
      const fresh = await getChatMessages(planId);
      setMessages(fresh);
      // Re-foca al textarea per a continuar la conversa.
      textareaRef.current?.focus();
      void reply;
    } catch (e) {
      // Rollback: treu l'optimistic del user.
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setPending(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // Cmd/Ctrl+Enter envia; Enter normal fa salt de línia.
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      send();
    }
  }

  function clearConversation() {
    if (messages.length === 0) return;
    const ok = window.confirm(
      "Esborrar tota la conversa? No es pot desfer.",
    );
    if (!ok) return;
    startClear(async () => {
      try {
        await clearChatMessages(planId);
        setMessages([]);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    });
  }

  return (
    <section className="max-w-3xl mx-auto">
      <header className="mb-6 flex items-start justify-between gap-3">
        <div>
          <h2 className="font-serif text-2xl font-semibold flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-peach-deep" strokeWidth={2.25} />
            Copilot
          </h2>
          <p className="text-sm text-ink-soft mt-1">
            Pregunta'm el que vulguis sobre{" "}
            <span className="italic text-ink">{planTitle}</span>. Conec tot el
            plan — llocs, dates, checklist i body.
          </p>
        </div>
        {messages.length > 0 && (
          <button
            type="button"
            onClick={clearConversation}
            disabled={clearing}
            className="text-xs text-ink-soft hover:text-peach-deep inline-flex items-center gap-1 shrink-0"
            title="Esborrar tota la conversa"
          >
            <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
            Començar de nou
          </button>
        )}
      </header>

      <div
        ref={listRef}
        className="space-y-4 max-h-[55vh] overflow-y-auto pr-1 mb-4"
      >
        {loading && (
          <div className="text-center text-sm text-ink-soft py-6">
            Carregant conversa…
          </div>
        )}
        {!loading && messages.length === 0 && (
          <div className="text-center py-10 rounded-md bg-cream-soft/50 border border-dashed border-ink-faint/40">
            <Sparkles
              className="h-8 w-8 mx-auto text-peach mb-3"
              strokeWidth={1.5}
            />
            <p className="text-sm text-ink-soft">
              Encara no heu parlat de res.
            </p>
            <p className="font-hand text-base text-ink-soft mt-2 -rotate-1">
              prova: "quina millor època per anar?"
            </p>
          </div>
        )}
        {messages.map((m) => (
          <ChatBubble key={m.id} message={m} planId={planId} />
        ))}
        {pending && (
          <div className="flex justify-start">
            <div className="rounded-2xl bg-cream-soft border border-ink-faint/30 px-4 py-3 text-sm text-ink-soft italic flex items-center gap-2 rounded-bl-md">
              <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />
              Pensant…
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="mb-3 rounded-md border border-peach-deep/40 bg-peach-soft/40 px-3 py-2 text-sm text-ink">
          {error}
        </div>
      )}

      <div className="relative">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Pregunta'm el que vulguis…"
          rows={3}
          disabled={pending}
          className="w-full px-4 py-3 pr-14 rounded-md border border-ink-faint/60 bg-cream-soft text-ink placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-peach/40 focus:border-peach/40 resize-none disabled:opacity-60"
        />
        <button
          type="button"
          onClick={send}
          disabled={!input.trim() || pending}
          aria-label="Enviar"
          className="absolute right-3 bottom-3 grid place-items-center h-9 w-9 rounded-full bg-peach text-white shadow-[0_2px_0_0_rgba(226,122,69,0.25)] hover:bg-peach-deep disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />
          ) : (
            <Send className="h-4 w-4" strokeWidth={2} />
          )}
        </button>
      </div>
      <p className="text-xs text-ink-soft mt-2">
        ⌘/Ctrl + Enter per enviar. De moment el copilot només respon — modificar
        el plan vindrà aviat.
      </p>
    </section>
  );
}

function ChatBubble({
  message,
  planId,
}: {
  message: ChatMessage;
  planId: string;
}) {
  const isUser = message.role === "user";
  // El user envia plain text; l'assistent pot enviar links Markdown que
  // converteix a Next.js Links.
  const rendered = isUser
    ? message.content
    : renderWithLinks(message.content, planId);
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] sm:max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
          isUser
            ? "bg-peach text-white rounded-br-md shadow-[0_2px_0_0_rgba(226,122,69,0.25)]"
            : "bg-cream-soft border border-ink-faint/30 text-ink rounded-bl-md"
        }`}
      >
        {rendered}
      </div>
    </div>
  );
}

/**
 * Parseja el text de l'assistant per detectar links Markdown `[text](href)` on
 * href és `#slug` (secció del body) o `/plans/x[#slug]` (un altre plan,
 * opcionalment amb secció). Tot el que no encaixi queda com a text pla.
 *
 * Les seccions s'enllacen a `/plans/{id}?v=resum#slug` perquè la secció no
 * existeix al DOM si estem al room "xat" — primer cal canviar a "resum".
 */
function renderWithLinks(content: string, planId: string): ReactNode {
  // Slugs `slugify()` només emeten lowercase alphanumeric + hyphen. Plan IDs
  // segueixen el mateix patró (uniqueSlug). Aquesta regex és intencionalment
  // estricta per no convertir tipografies aleatòries en links.
  const re =
    /\[([^\]]+)\]\((#[a-z0-9][a-z0-9-]*|\/plans\/[a-z0-9][a-z0-9-]*(?:#[a-z0-9][a-z0-9-]*)?)\)/g;

  const parts: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = re.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push(
        <Fragment key={`t-${lastIndex}`}>
          {content.slice(lastIndex, match.index)}
        </Fragment>,
      );
    }
    const [, text, target] = match;

    let href: string;
    if (target.startsWith("#")) {
      // Secció del pla actual: canvia a Resum i afegeix l'ancora.
      href = `/plans/${planId}?v=resum${target}`;
    } else {
      // `/plans/slug` o `/plans/slug#section`. Si té secció, forcem v=resum.
      const hashIdx = target.indexOf("#");
      if (hashIdx >= 0) {
        const path = target.slice(0, hashIdx);
        const hash = target.slice(hashIdx);
        href = `${path}?v=resum${hash}`;
      } else {
        href = target;
      }
    }

    parts.push(
      <Link
        key={`l-${match.index}`}
        href={href}
        className="inline text-peach-deep underline underline-offset-2 hover:text-ink font-medium"
      >
        {text}
      </Link>,
    );
    lastIndex = re.lastIndex;
  }

  if (lastIndex < content.length) {
    parts.push(
      <Fragment key={`t-${lastIndex}`}>{content.slice(lastIndex)}</Fragment>,
    );
  }

  return parts;
}
