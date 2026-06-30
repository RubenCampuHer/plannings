import { runCopilotTurn, persistCopilotExchange } from "@/lib/copilot-engine";
import type { ChatMode } from "@/lib/chat-prompt";

export const dynamic = "force-dynamic";

/**
 * Streaming del copilot. Emet NDJSON (un objecte JSON per línia):
 *   { "type": "text", "delta": "..." }   ← fragments de text a mesura que arriben
 *   { "type": "done", "assistantId": "...", "proposals": [...] }
 *   { "type": "error", "message": "..." }
 * Reutilitza el motor compartit amb el server action `sendChatMessage`.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id: planId } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response("JSON invàlid", { status: 400 });
  }
  const b = body as { content?: unknown; mode?: unknown };
  const content = typeof b.content === "string" ? b.content.trim() : "";
  const mode: ChatMode = b.mode === "conversa" ? "conversa" : "edicio";
  if (!content) return new Response("El missatge no pot estar buit.", { status: 400 });
  if (content.length > 4000) {
    return new Response("Missatge massa llarg (màx 4000 caràcters).", { status: 400 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (obj: unknown) =>
        controller.enqueue(encoder.encode(`${JSON.stringify(obj)}\n`));
      try {
        const { replyText, proposals } = await runCopilotTurn(
          planId,
          content,
          mode,
          (delta) => send({ type: "text", delta }),
        );
        const assistantId = await persistCopilotExchange(
          planId,
          content,
          replyText,
          proposals,
        );
        send({ type: "done", assistantId, proposals });
      } catch (e) {
        send({ type: "error", message: e instanceof Error ? e.message : String(e) });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
