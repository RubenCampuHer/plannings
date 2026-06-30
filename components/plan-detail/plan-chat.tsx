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
  ChevronDown,
  ChevronRight,
  FileText,
  ListTodo,
  Loader2,
  MapPin,
  Pencil,
  Send,
  Sparkles,
  Trash2,
  X,
  XCircle,
  AlertCircle,
} from "lucide-react";
import {
  applyProposal,
  cancelProposal,
  clearChatMessages,
  getChatMessages,
  type ChatMessage,
} from "@/lib/chat-actions";
import type { ChatMode, Proposal } from "@/lib/chat-prompt";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

const MODE_KEY = "plannings:chat-mode";

/**
 * Sala de xat amb el copilot del plan. Llegeix tot el context (metadades +
 * places + checklist + body + pare/fills) i pot proposar canvis via function
 * calling — l'usuari els confirma amb una targeta de proposta dins del xat.
 */
export function PlanChat({ planId }: { planId: string }) {
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [clearing, startClear] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<ChatMode>("conversa");
  // Set d'ids de propostes en procés (aplicant/cancel·lant) per mostrar loaders
  // a les targetes corresponents sense bloquejar tot el xat.
  const [busyProposals, setBusyProposals] = useState<Set<string>>(new Set());
  const [confirmingClear, setConfirmingClear] = useState(false);
  // true un cop arriba el primer token del stream (amaga el "Pensant…").
  const [streaming, setStreaming] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Restaura el mode triat per l'usuari (per dispositiu).
  useEffect(() => {
    try {
      const saved = localStorage.getItem(MODE_KEY);
      if (saved === "conversa" || saved === "edicio") setMode(saved);
    } catch {
      // ignorat
    }
  }, []);

  // Persisteix el mode quan canvia.
  useEffect(() => {
    try {
      localStorage.setItem(MODE_KEY, mode);
    } catch {
      // ignorat
    }
  }, [mode]);

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
     
  }, [messages.length, pending]);

  async function send() {
    const text = input.trim();
    if (!text || pending) return;
    setError(null);

    const tempId = `temp-${crypto.randomUUID()}`;
    const streamId = `stream-${crypto.randomUUID()}`;
    const optimisticUser: ChatMessage = {
      id: tempId,
      role: "user",
      content: text,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimisticUser]);
    setInput("");
    setPending(true);
    setStreaming(false);

    try {
      const res = await fetch(`/api/plans/${planId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text, mode }),
      });
      if (!res.ok || !res.body) {
        throw new Error((await res.text()) || "Error de connexió amb el copilot.");
      }

      // Llegeix el stream NDJSON: { type: "text" | "done" | "error", ... }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let acc = "";
      let started = false;
      let errored: string | null = null;

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const evt = JSON.parse(line) as
            | { type: "text"; delta: string }
            | { type: "done"; assistantId: string }
            | { type: "error"; message: string };
          if (evt.type === "text") {
            acc += evt.delta;
            if (!started) {
              started = true;
              setStreaming(true);
              setMessages((prev) => [
                ...prev,
                {
                  id: streamId,
                  role: "assistant",
                  content: acc,
                  createdAt: new Date().toISOString(),
                },
              ]);
            } else {
              setMessages((prev) =>
                prev.map((m) => (m.id === streamId ? { ...m, content: acc } : m)),
              );
            }
          } else if (evt.type === "error") {
            errored = evt.message;
          }
        }
      }
      if (errored) throw new Error(errored);

      // Recarrega per tenir ids reals i les propostes correctament formatades.
      const fresh = await getChatMessages(planId);
      setMessages(fresh);
      textareaRef.current?.focus();
    } catch (e) {
      setMessages((prev) => prev.filter((m) => m.id !== tempId && m.id !== streamId));
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setPending(false);
      setStreaming(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      send();
    }
  }

  function clearConversation() {
    startClear(async () => {
      try {
        await clearChatMessages(planId);
        setMessages([]);
        setConfirmingClear(false);
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
      <header className="shrink-0 mb-3 space-y-2">
        <div className="flex items-center justify-between gap-3">
          <ModeToggle mode={mode} onChange={setMode} disabled={pending} />
          {messages.length > 0 && (
            <button
              type="button"
              onClick={() => setConfirmingClear(true)}
              disabled={clearing}
              className="text-xs text-ink-soft hover:text-peach-deep inline-flex items-center gap-1 shrink-0 min-h-[40px] sm:min-h-0 px-1"
              title="Esborrar tota la conversa"
            >
              <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
              Esborrar
            </button>
          )}
        </div>
        <p className="text-xs text-ink-soft leading-snug">
          {mode === "conversa"
            ? "Mode conversa: el copilot només respon. Per fer canvis al plan, passa a Edició."
            : "Mode edició: el copilot pot proposar canvis al plan i als seus sub-plans. Tu confirmes."}
        </p>
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
        {pending && !streaming && (
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
          placeholder={
            mode === "conversa"
              ? "Pregunta'm sobre el plan…"
              : "Demana'm afegir un lloc, item de checklist o sub-plan…"
          }
          rows={2}
          disabled={pending}
          className="w-full px-3 py-2 pr-12 rounded-md border border-ink-faint/60 bg-cream-soft text-ink text-base sm:text-sm placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-peach/40 focus:border-peach/40 resize-none disabled:opacity-60"
        />
        <button
          type="button"
          onClick={send}
          disabled={!input.trim() || pending}
          aria-label="Enviar"
          className="absolute right-2 bottom-2 grid place-items-center h-10 w-10 sm:h-8 sm:w-8 rounded-full bg-peach text-white shadow-[0_2px_0_0_rgba(226,122,69,0.25)] hover:bg-peach-deep disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {pending ? (
            <Loader2 className="h-4 w-4 sm:h-3.5 sm:w-3.5 animate-spin" strokeWidth={2} />
          ) : (
            <Send className="h-4 w-4 sm:h-3.5 sm:w-3.5" strokeWidth={2} />
          )}
        </button>
      </div>
      <p className="shrink-0 hidden sm:block text-xs text-ink-soft mt-1">
        ⌘/Ctrl + Enter per enviar
      </p>

      <ConfirmDialog
        open={confirmingClear}
        title="Esborrar tota la conversa?"
        description="No es pot desfer."
        confirmLabel="Esborrar"
        destructive
        busy={clearing}
        onConfirm={clearConversation}
        onCancel={() => setConfirmingClear(false)}
      />
    </section>
  );
}

function ModeToggle({
  mode,
  onChange,
  disabled,
}: {
  mode: ChatMode;
  onChange: (m: ChatMode) => void;
  disabled?: boolean;
}) {
  return (
    <div
      role="tablist"
      aria-label="Mode del copilot"
      className="inline-flex p-0.5 rounded-full bg-cream-soft border border-ink-faint/40 text-xs font-medium"
    >
      {(["conversa", "edicio"] as const).map((m) => {
        const active = mode === m;
        return (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={active}
            disabled={disabled}
            onClick={() => onChange(m)}
            className={`px-3 py-1 rounded-full transition-colors disabled:opacity-50 ${
              active
                ? "bg-peach text-white shadow-[0_1px_0_0_rgba(226,122,69,0.25)]"
                : "text-ink-soft hover:text-ink"
            }`}
          >
            {m === "conversa" ? "Conversa" : "Edició"}
          </button>
        );
      })}
    </div>
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
    case "update_plan_metadata":
      return {
        title: "Actualitzar metadades del plan",
        Icon: Pencil,
      };
    case "update_plan_body":
      return {
        title: "Reescriure el cos del plan",
        Icon: FileText,
      };
    case "delete_place": {
      const name = p.preview?.place_before?.name ?? "lloc";
      return { title: `Esborrar "${name}" del mapa`, Icon: Trash2 };
    }
    case "update_checklist_item": {
      const before = p.preview?.item_before?.text ?? "ítem";
      return { title: `Editar checklist: "${before}"`, Icon: ListTodo };
    }
    case "update_subplan_body":
      return {
        title: `Reescriure el cos del sub-plan "${subTitle(p)}"`,
        Icon: FileText,
      };
    case "update_subplan_metadata":
      return {
        title: `Actualitzar metadades del sub-plan "${subTitle(p)}"`,
        Icon: Pencil,
      };
    case "add_subplan_checklist_item":
      return {
        title: `Afegir a la checklist del sub-plan "${subTitle(p)}": "${String(args.text ?? "?")}"`,
        Icon: ListTodo,
      };
    case "update_subplan_checklist_item": {
      const before = p.preview?.item_before?.text ?? "ítem";
      return {
        title: `Editar checklist del sub-plan "${subTitle(p)}": "${before}"`,
        Icon: ListTodo,
      };
    }
    case "add_subplan_place":
      return {
        title: `Afegir "${String(args.name ?? "?")}" al mapa del sub-plan "${subTitle(p)}"`,
        Icon: MapPin,
      };
    case "delete_subplan_place": {
      const name = p.preview?.place_before?.name ?? "lloc";
      return {
        title: `Esborrar "${name}" del mapa del sub-plan "${subTitle(p)}"`,
        Icon: Trash2,
      };
    }
    case "update_parent_body":
      return {
        title: `Reescriure el cos del pla pare "${parentTitle(p)}"`,
        Icon: FileText,
      };
    case "update_parent_metadata":
      return {
        title: `Actualitzar metadades del pla pare "${parentTitle(p)}"`,
        Icon: Pencil,
      };
    case "add_parent_checklist_item":
      return {
        title: `Afegir a la checklist del pla pare "${parentTitle(p)}": "${String(args.text ?? "?")}"`,
        Icon: ListTodo,
      };
    case "update_parent_checklist_item": {
      const before = p.preview?.item_before?.text ?? "ítem";
      return {
        title: `Editar checklist del pla pare "${parentTitle(p)}": "${before}"`,
        Icon: ListTodo,
      };
    }
    case "add_parent_place":
      return {
        title: `Afegir "${String(args.name ?? "?")}" al mapa del pla pare "${parentTitle(p)}"`,
        Icon: MapPin,
      };
    case "delete_parent_place": {
      const name = p.preview?.place_before?.name ?? "lloc";
      return {
        title: `Esborrar "${name}" del mapa del pla pare "${parentTitle(p)}"`,
        Icon: Trash2,
      };
    }
  }
}

/** Títol del sub-plan target d'una proposta *_subplan (per a les cards). */
function subTitle(p: Proposal): string {
  return p.preview?.subplan?.title ?? "?";
}

/** Títol del pla pare target d'una proposta *_parent. */
function parentTitle(p: Proposal): string {
  return p.preview?.parent?.title ?? "?";
}

function ProposalDetails({ proposal }: { proposal: Proposal }) {
  const args = proposal.arguments;
  const subLabel = proposal.preview?.subplan ? (
    <p className="text-[11px] text-peach-deep font-medium">
      Sub-plan: {proposal.preview.subplan.title}
    </p>
  ) : null;
  const parentLabel = proposal.preview?.parent ? (
    <p className="text-[11px] text-peach-deep font-medium">
      Pla pare: {proposal.preview.parent.title}
    </p>
  ) : null;

  switch (proposal.function_name) {
    case "add_place":
      return renderPlaceAdd(args, proposal.preview?.geocoded);
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
    case "update_plan_metadata":
      return renderMetadataDiff(args, proposal.preview?.metadata_before);
    case "update_plan_body":
      return renderBodyStats(args, proposal.preview?.body_stats);
    case "delete_place":
      return renderPlaceDelete(args, proposal.preview?.place_before);
    case "update_checklist_item":
      return renderChecklistDiff(args, proposal.preview?.item_before);
    // ---------- Variants de SUB-PLAN: mateix render + etiqueta del sub-plan ----------
    case "update_subplan_body":
      return (
        <div className="mt-1 space-y-1">
          {subLabel}
          {renderBodyStats(args, proposal.preview?.body_stats)}
        </div>
      );
    case "update_subplan_metadata":
      return (
        <div className="mt-1 space-y-1">
          {subLabel}
          {renderMetadataDiff(args, proposal.preview?.metadata_before)}
        </div>
      );
    case "add_subplan_checklist_item":
      return subLabel ? <div className="mt-1">{subLabel}</div> : null;
    case "update_subplan_checklist_item":
      return (
        <div className="mt-1 space-y-1">
          {subLabel}
          {renderChecklistDiff(args, proposal.preview?.item_before)}
        </div>
      );
    case "add_subplan_place":
      return (
        <div className="mt-1 space-y-1">
          {subLabel}
          {renderPlaceAdd(args, proposal.preview?.geocoded)}
        </div>
      );
    case "delete_subplan_place":
      return (
        <div className="mt-1 space-y-1">
          {subLabel}
          {renderPlaceDelete(args, proposal.preview?.place_before)}
        </div>
      );
    // ---------- Variants de PLA PARE: mateix render + etiqueta del pare ----------
    case "update_parent_body":
      return (
        <div className="mt-1 space-y-1">
          {parentLabel}
          {renderBodyStats(args, proposal.preview?.body_stats)}
        </div>
      );
    case "update_parent_metadata":
      return (
        <div className="mt-1 space-y-1">
          {parentLabel}
          {renderMetadataDiff(args, proposal.preview?.metadata_before)}
        </div>
      );
    case "add_parent_checklist_item":
      return parentLabel ? <div className="mt-1">{parentLabel}</div> : null;
    case "update_parent_checklist_item":
      return (
        <div className="mt-1 space-y-1">
          {parentLabel}
          {renderChecklistDiff(args, proposal.preview?.item_before)}
        </div>
      );
    case "add_parent_place":
      return (
        <div className="mt-1 space-y-1">
          {parentLabel}
          {renderPlaceAdd(args, proposal.preview?.geocoded)}
        </div>
      );
    case "delete_parent_place":
      return (
        <div className="mt-1 space-y-1">
          {parentLabel}
          {renderPlaceDelete(args, proposal.preview?.place_before)}
        </div>
      );
  }
}

type Args = Record<string, unknown>;
type Preview = NonNullable<Proposal["preview"]>;

function renderPlaceAdd(args: Args, geo: Preview["geocoded"]) {
  return (
    <div className="text-xs text-ink-soft mt-1 space-y-0.5">
      {geo ? (
        <>
          <p>
            📍 <span className="text-ink">{geo.displayName}</span>
          </p>
          <p className="font-mono text-[10px]">
            {geo.lat.toFixed(4)}, {geo.lng.toFixed(4)}
            {geo.country ? ` · ${geo.country}` : ""}
          </p>
        </>
      ) : (
        <p>
          🔍 <span className="font-mono">{String(args.search_query ?? "")}</span>
        </p>
      )}
      {typeof args.why === "string" && args.why.trim() && (
        <p className="italic">{args.why}</p>
      )}
    </div>
  );
}

function renderPlaceDelete(args: Args, before: Preview["place_before"]) {
  return (
    <div className="text-xs text-ink-soft mt-1">
      {before ? (
        <p>
          📍 <span className="line-through">{before.name}</span>
          {before.country && ` (${before.country})`}
        </p>
      ) : (
        <p className="font-mono">id={String(args.place_id ?? "?")}</p>
      )}
    </div>
  );
}

function renderMetadataDiff(args: Args, before: Preview["metadata_before"] = {}) {
  const b = before ?? {};
  const fields: Array<[string, string | undefined, string | undefined]> = [
    ["Títol", b.title, typeof args.title === "string" ? args.title : undefined],
    ["Resum", b.summary, typeof args.summary === "string" ? args.summary : undefined],
    ["Destinació", b.destination, typeof args.destination === "string" ? args.destination : undefined],
    ["Inici", b.start_date, typeof args.start_date === "string" ? args.start_date : undefined],
    ["Fi", b.end_date, typeof args.end_date === "string" ? args.end_date : undefined],
  ];
  return (
    <div className="text-xs mt-1 space-y-1.5">
      {fields
        .filter(([, , next]) => next !== undefined)
        .map(([label, prev, next]) => (
          <div key={label}>
            <p className="text-ink-soft font-medium">{label}</p>
            <p className="text-ink-soft line-through opacity-70 break-words">
              {prev || "(buit)"}
            </p>
            <p className="text-ink break-words">{next || "(buit)"}</p>
          </div>
        ))}
    </div>
  );
}

function renderBodyStats(args: Args, stats: Preview["body_stats"]) {
  const newBody = typeof args.new_body === "string" ? args.new_body : "";
  const newSummary =
    typeof args.summary === "string" && args.summary.trim()
      ? args.summary.trim()
      : null;
  return (
    <div className="text-xs text-ink-soft mt-1 space-y-1.5">
      {stats && (
        <p>
          {stats.before_chars} car · {stats.before_lines} línies →{" "}
          <span className="text-ink font-medium">
            {stats.after_chars} car · {stats.after_lines} línies
          </span>{" "}
          <span
            className={
              stats.after_chars < stats.before_chars
                ? "text-peach-deep"
                : "text-sage-deep"
            }
          >
            ({stats.after_chars - stats.before_chars > 0 ? "+" : ""}
            {stats.after_chars - stats.before_chars} car)
          </span>
        </p>
      )}
      {newSummary && (
        <p>
          <span className="font-medium text-ink-soft">Resum nou: </span>
          <span className="italic text-ink">{newSummary}</span>
        </p>
      )}
      <BodyPreviewCollapsible body={newBody} />
    </div>
  );
}

function renderChecklistDiff(args: Args, before: Preview["item_before"]) {
  const nextText = typeof args.text === "string" ? args.text : undefined;
  const nextDone = typeof args.done === "boolean" ? args.done : undefined;
  return (
    <div className="text-xs mt-1 space-y-1">
      {nextText !== undefined && (
        <>
          <p className="text-ink-soft line-through opacity-70 break-words">
            {before?.text ?? "(?)"}
          </p>
          <p className="text-ink break-words">{nextText}</p>
        </>
      )}
      {nextDone !== undefined && (
        <p className="text-ink-soft">
          {nextDone ? "✓ marcar com a fet" : "□ desmarcar"}
        </p>
      )}
    </div>
  );
}

function BodyPreviewCollapsible({ body }: { body: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1 text-peach-deep hover:text-ink text-xs font-medium"
      >
        {open ? (
          <ChevronDown className="h-3 w-3" strokeWidth={2.5} />
        ) : (
          <ChevronRight className="h-3 w-3" strokeWidth={2.5} />
        )}
        {open ? "Amaga el cos nou" : "Veure el cos nou"}
      </button>
      {open && (
        <pre className="mt-2 p-2 rounded-md bg-cream-deep/60 border border-ink-faint/40 text-[11px] text-ink whitespace-pre-wrap break-words max-h-72 overflow-auto font-sans">
          {body}
        </pre>
      )}
    </div>
  );
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
