import { streamText, convertToModelMessages } from "ai";
import type { UIMessage } from "ai";

import { createClient } from "@/lib/supabase/server";
import { getChatModel } from "@/lib/ai/provider";
import { mem0 } from "@/lib/ai/mem0";
import { buildChatSystemPrompt } from "@/lib/ai/chat-prompt";

export async function POST(req: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const body = await req.json();
  const messages: UIMessage[] = body.messages ?? [];
  const sessionId: string | undefined = body.sessionId;

  if (!sessionId || !messages.length) {
    return new Response("Invalid request", { status: 400 });
  }

  // Verify ownership and retrieve the snapshotted system_prompt.
  const { data: session } = await supabase
    .from("sessions")
    .select("system_prompt")
    .eq("id", sessionId)
    .eq("user_id", user.id)
    .single();

  if (!session) return new Response("Session not found", { status: 404 });

  // Extract last user message text (UIMessage.parts is an array of typed parts).
  const lastUserParts = [...messages]
    .reverse()
    .find((m) => m.role === "user")?.parts;
  const lastUserText =
    lastUserParts
      ?.filter((p): p is { type: "text"; text: string } => p.type === "text")
      .map((p) => p.text)
      .join("") ?? "";

  // Parallelize Mem0 search — fails silently, never blocks the chat turn.
  const [memories] = await Promise.all([mem0.search(user.id, lastUserText)]);

  const systemPrompt = buildChatSystemPrompt(session.system_prompt, memories);

  // convertToModelMessages is async in AI SDK v6.
  const modelMessages = await convertToModelMessages(messages);

  const result = streamText({
    model: getChatModel(),
    system: systemPrompt,
    messages: modelMessages,
    maxOutputTokens: 1024,
    onFinish: async ({ text }) => {
      if (!lastUserText || !text) return;

      // Persist the turn to DB.
      await supabase.from("messages").insert([
        {
          session_id: sessionId,
          user_id: user.id,
          role: "user" as const,
          content: lastUserText,
        },
        {
          session_id: sessionId,
          user_id: user.id,
          role: "assistant" as const,
          content: text,
        },
      ]);

      // Incremental memory extraction: send this turn to Mem0 immediately so
      // facts ("I work night duty") survive even if the tab closes before
      // session-end extraction fires. Fire-and-forget — never blocks response.
      mem0.add(user.id, [
        { role: "user", content: lastUserText },
        { role: "assistant", content: text },
      ]);
    },
  });

  return result.toUIMessageStreamResponse();
}
