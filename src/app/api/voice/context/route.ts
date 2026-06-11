/** @format */

import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/voice/context?session_id=<id>
 *
 * Returns the persona (session system_prompt) injected as the ElevenLabs
 * system-prompt override at WebSocket handshake time.
 *
 * Persona only — long-term memories are NOT fetched here. Per-turn retrieval
 * is owned by the `search_memory` client tool (/api/voice/memory-search),
 * which searches mem0 with the user's live utterance. Keeping mem0 out of
 * this route removes its wait from the session-start hot path and avoids
 * double-injecting memories.
 */
export async function GET(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return new Response("Unauthorized", { status: 401 });

  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get("session_id");

  if (!sessionId) {
    return new Response("Missing session_id", { status: 400 });
  }

  const { data: session } = await supabase
    .from("sessions")
    .select("id, system_prompt, user_id")
    .eq("id", sessionId)
    .eq("user_id", user.id)
    .single();

  if (!session) {
    return new Response("Session not found", { status: 404 });
  }

  console.log("[voice/context] session:", sessionId);

  // Append the search_memory calling instruction directly to the override so it
  // travels with the persona. `overrides.agent.prompt.prompt` REPLACES the
  // dashboard system prompt entirely — anything written there is silently
  // discarded. Baking this here keeps the override self-contained and means
  // the dashboard system prompt only needs a minimal fallback (or nothing).
  const MEMORY_INSTRUCTION = `\n\nFor every user turn: call search_memory with what the user just said as the query, then reply. Use any returned memories to personalise your response naturally — do not say "according to my memory" or mention the tool.`;

  const fullPrompt = `${session.system_prompt}${MEMORY_INSTRUCTION}`;

  // `context` kept as the field the client reads for the prompt override.
  return Response.json({
    persona: session.system_prompt,
    context: fullPrompt,
  });
}
