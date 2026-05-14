"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Fragment,
  useEffect,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import {
  Check,
  CheckCircle2,
  ListTodo,
  Loader2,
  MapPin,
  Send,
  Sparkles,
  Trash2,
  X,
  XCircle,
  AlertCircle,
  ChevronRight,
} from "lucide-react";
import {
  applyProposal,
  cancelProposal,
  clearChatMessages,
  getChatMessages,
  sendChatMessage,
  type ChatMessage,
} from "@/lib/chat-actions";
import type { Proposal } from "@/lib/chat-prompt";

/**
 * Sala de xat amb el copilot del plan. Llegeix tot el context (metadades +
 * places + checklist + body + pare/fills) i pot proposar canvis via function
 * calling — l'usuari els confirma amb una targeta de proposta dins del xat.
 */
export function PlanChat({
  planId,
  planTitle,
}: {
  planId: string;
  planTitle: string;
}) {
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [clearing, startClear] = useTransition();
  const [error, setError] = useState<string | null>(null);
  // Set d'ids de propostes en procés (aplicant/cancel·lant) per mostrar loaders
  // a les targetes corresponents sense bloquejar tot el xat.
  const [busyProposals, setBusyProposals] = useState<Set<string>>(new Set());
  const listRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
      await sendChatMessage(planId, text);
      // Recarrega tots els missatges per tenir el user message amb el seu uuid
      // real i l'assistant amb propostes correctament formatades.
      const fresh = await getChatMessages(planId);
      setMessages(fresh);
      textareaRef.current?.focus();
    } catch (e) {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setPending(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      send();
    }
  }

  function clearConversation() {
    if (messages.length === 0) return;
    const ok = window.confirm("Esborrar tota la conversa? No es pot desfer.");
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

  async function handleApply(messageId: string, proposalId: string) {
    setBusyProposals((prev) => new Set(prev).add(proposalId));
    try {
      const updated = await applyProposal(planId, messageId, proposalId);
      setMessages((prev) => prev.map((m) => (m.id === messageId ? updated : m)));
      // L'aplicació pot haver canviat dades del plan (places, checklist,
      // sub-plans) — refresquem la resta de la pàgina.
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyProposals((prev) => {
        const next = new Set(prev);
        next.delete(proposalId);
        return next;
      });
    }
  }

  async function handleCancel(messageId: string, proposalId: string) {
    setBusyProposals((prev) => new Set(prev).add(proposalId));
    try {
      const updated = await cancelProposal(planId, messageId, proposalId);
      setMessages((prev) => prev.map((m) => (m.id === messageId ? updated : m)));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyProposals((prev) => {
        const next = new Set(prev);
        next.delete(proposalId);
        return next;
      });
    }
  }

  return (
    <section className="flex flex-col h-full min-h-0">
      <header className="shrink-0 mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-ink-soft leading-relaxed">
            Pregunta'm o demana'm afegir coses al plan{" "}
            <span className="italic text-ink truncate">{planTitle}</span>.
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
            Esborrar
          </button>
        )}
      </header>

      <div
        ref={listRef}
        className="flex-1 min-h-0 space-y-3 overflow-y-auto pr-1 mb-3"
      >
        {loading && (
          <div className="text-center text-sm text-ink-soft py-6">
            Carregant conversa…
          </div>
        )}
        {!loading && messages.length === 0 && (
          <div className="text-center py-8 rounded-md bg-cream-soft/50 border border-dashed border-ink-faint/40">
            <Sparkles
              className="h-7 w-7 mx-auto text-peach mb-2"
              strokeWidth={1.5}
            />
            <p className="text-sm text-ink-soft">
              Encara no heu parlat de res.
            </p>
            <p className="font-hand text-base text-ink-soft mt-2 -rotate-1">
              prova: "afegeix Cinema Verdi al mapa"
            </p>
          </div>
        )}
        {messages.map((m) => (
          <ChatBubble
            key={m.id}
            message={m}
            planId={planId}
            busyProposals={busyProposals}
            onApply={(pid) => handleApply(m.id, pid)}
            onCancel={(pid) => handleCancel(m.id, pid)}
          />
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
        <div className="shrink-0 mb-2 rounded-md border border-peach-deep/40 bg-peach-soft/40 px-3 py-2 text-xs text-ink">
          {error}
        </div>
      )}

      <div className="shrink-0 relative">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Pregunta o demana afegir alguna cosa…"
          rows={2}
          disabled={pending}
          className="w-full px-3 py-2 pr-12 rounded-md border border-ink-faint/60 bg-cream-soft text-ink text-sm placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-peach/40 focus:border-peach/40 resize-none disabled:opacity-60"
        />
        <button
          type="button"
          onClick={send}
          disabled={!input.trim() || pending}
          aria-label="Enviar"
          className="absolute right-2 bottom-2 grid place-items-center h-8 w-8 rounded-full bg-peach text-white shadow-[0_2px_0_0_rgba(226,122,69,0.25)] hover:bg-peach-deep disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {pending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2} />
          ) : (
            <Send className="h-3.5 w-3.5" strokeWidth={2} />
          )}
        </button>
      </div>
      <p className="shrink-0 text-[10px] text-ink-soft mt-1">
        ⌘/Ctrl + Enter per enviar
      </p>
    </section>
  );
}

function ChatBubble({
  message,
  planId,
  busyProposals,
  onApply,
  onCancel,
}: {
  message: ChatMessage;
  planId: string;
  busyProposals: Set<string>;
  onApply: (proposalId: string) => void;
  onCancel: (proposalId: string) => void;
}) {
  const isUser = message.role === "user";
  const rendered = isUser
    ? message.content
    : renderWithLinks(message.content, planId);
  const hasProposals = !isUser && (message.proposals?.length ?? 0) > 0;

  return (
    <div className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}>
      <div
        className={`max-w-[85%] sm:max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
          isUser
            ? "bg-peach text-white rounded-br-md shadow-[0_2px_0_0_rgba(226,122,69,0.25)]"
            : "bg-cream-soft border border-ink-faint/30 text-ink rounded-bl-md"
        }`}
      >
        {rendered}
      </div>
      {hasProposals && (
        <div className="max-w-[85%] sm:max-w-[80%] mt-2 space-y-2 w-full">
          {message.proposals!.map((p) => (
            <ProposalCard
              key={p.id}
              proposal={p}
              busy={busyProposals.has(p.id)}
              onApply={() => onApply(p.id)}
              onCancel={() => onCancel(p.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ProposalCard({
  proposal,
  busy,
  onApply,
  onCancel,
}: {
  proposal: Proposal;
  busy: boolean;
  onApply: () => void;
  onCancel: () => void;
}) {
  const { title, Icon } = describeProposal(proposal);

  if (proposal.status === "applied") {
    return (
      <div className="rounded-xl border border-sage-deep/40 bg-sage-soft/30 px-4 py-3 flex items-start gap-3">
        <CheckCircle2
          className="h-5 w-5 text-sage-deep shrink-0 mt-0.5"
          strokeWidth={2}
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm text-ink font-medium">{title}</p>
          {proposal.result_message && (
            <p className="text-xs text-ink-soft mt-0.5">{proposal.result_message}</p>
          )}
          {proposal.result_path && (
            <Link
              href={proposal.result_path}
              className="inline-flex items-center gap-1 text-xs text-peach-deep hover:text-ink mt-1 font-medium"
            >
              Veure-ho
              <ChevronRight className="h-3 w-3" strokeWidth={2} />
            </Link>
          )}
        </div>
      </div>
    );
  }

  if (proposal.status === "cancelled") {
    return (
      <div className="rounded-xl border border-ink-faint/40 bg-cream-soft/40 px-4 py-2 flex items-center gap-2 text-ink-soft">
        <XCircle className="h-4 w-4 shrink-0" strokeWidth={2} />
        <p className="text-xs">
          Cancel·lat: <span className="line-through">{title}</span>
        </p>
      </div>
    );
  }

  if (proposal.status === "failed") {
    return (
      <div className="rounded-xl border border-peach-deep/40 bg-peach-soft/30 px-4 py-3 flex items-start gap-3">
        <AlertCircle
          className="h-5 w-5 text-peach-deep shrink-0 mt-0.5"
          strokeWidth={2}
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm text-ink font-medium">No s'ha pogut: {title}</p>
          {proposal.result_message && (
            <p className="text-xs text-ink-soft mt-0.5">{proposal.result_message}</p>
          )}
        </div>
      </div>
    );
  }

  // Pending
  return (
    <div className="rounded-xl border border-peach/40 bg-gradient-to-br from-peach-soft/30 to-cream-soft px-4 py-3 space-y-2">
      <div className="flex items-start gap-3">
        <Icon className="h-5 w-5 text-peach-deep shrink-0 mt-0.5" strokeWidth={2} />
        <div className="min-w-0 flex-1">
          <p className="text-sm text-ink font-medium">{title}</p>
          <ProposalDetails proposal={proposal} />
        </div>
      </div>
      <div className="flex items-center gap-2 pt-1">
        <button
          type="button"
          onClick={onApply}
          disabled={busy}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-peach text-white text-xs font-medium hover:bg-peach-deep disabled:opacity-50 transition-colors"
        >
          {busy ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2} />
          ) : (
            <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
          )}
          Aplicar
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs text-ink-soft hover:text-ink hover:bg-cream-soft disabled:opacity-50 transition-colors"
        >
          <X className="h-3.5 w-3.5" strokeWidth={2} />
          Cancel·lar
        </button>
      </div>
    </div>
  );
}

function describeProposal(p: Proposal): {
  title: string;
  Icon: typeof MapPin;
} {
  const args = p.arguments;
  switch (p.function_name) {
    case "add_place":
      return {
        title: `Afegir "${String(args.name ?? "?")}" al mapa`,
        Icon: MapPin,
      };
    case "add_checklist_item":
      return {
        title: `Afegir a la checklist: "${String(args.text ?? "?")}"`,
        Icon: ListTodo,
      };
    case "add_subplan":
      return {
        title: `Crear sub-plan: "${String(args.title ?? "?")}"`,
        Icon: Sparkles,
      };
  }
}

function ProposalDetails({ proposal }: { proposal: Proposal }) {
  const args = proposal.arguments;
  switch (proposal.function_name) {
    case "add_place":
      return (
        <div className="text-xs text-ink-soft mt-1 space-y-0.5">
          <p>
            🔍 <span className="font-mono">{String(args.search_query ?? "")}</span>
          </p>
          {typeof args.why === "string" && args.why.trim() && (
            <p className="italic">{args.why}</p>
          )}
        </div>
      );
    case "add_checklist_item":
      return null;
    case "add_subplan":
      return (
        <div className="text-xs text-ink-soft mt-1 space-y-0.5">
          {typeof args.destination === "string" && args.destination.trim() && (
            <p>📍 {args.destination}</p>
          )}
          {typeof args.summary === "string" && args.summary.trim() && (
            <p className="italic">{args.summary}</p>
          )}
          {Boolean(args.start_date || args.end_date) && (
            <p>
              📅 {String(args.start_date ?? "?")} → {String(args.end_date ?? "?")}
            </p>
          )}
        </div>
      );
  }
}

function renderWithLinks(content: string, planId: string): ReactNode {
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
      href = `/plans/${planId}?v=resum${target}`;
    } else {
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
