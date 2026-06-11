/** @format */

import { createClient } from "@/lib/supabase/server";
import { mem0 } from "@/lib/ai/mem0";

const NO_MEMORIES = "No relevant memories.";

/**
 * GET /api/voice/memory-search?query=<user utterance>
 *
 * Per-turn memory retrieval for voice chat. The ElevenLabs agent calls the
 * `search_memory` client tool (configured with expects_response: true) on
 * every user turn, passing what the user just said as `query`. The browser
 * handler hits this endpoint and returns the memories as a plain string the
 * agent appends to its context before replying — same turn, no lag.
 *
 * The agent is blocked on the audio stream while this runs, so latency is
 * dead air. mem0 is capped at 1.5 s here (vs 3 s internally) — a slow search
 * fails fast and the agent replies without memory rather than hanging.
 *
 * No session ownership check: mem0 is keyed by the authenticated user and
 * search is read-only, so the extra DB round-trip would only add latency.
 */
export async function GET(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return new Response("Unauthorized", { status: 401 });

  const { searchParams } = new URL(req.url);
  const query = searchParams.get("query")?.trim();

  console.log("[voice/memory-search] user query:", query);
  if (!query) {
    return Response.json({ text: NO_MEMORIES });
  }

  // The ElevenLabs tool Response timeout must be raised to 3 s in the dashboard
  // for this to land — mem0's hosted semantic search naturally takes 400 ms–1.5 s.
  // Cap at 2 s here so we still return before the client AbortController (2.5 s)
  // and the ElevenLabs tool timeout (3 s) fire. A slow search returns empty so
  // the agent replies without memory rather than hanging.
  const memories = await Promise.race([
    mem0.search(user.id, query),
    new Promise<string[]>((resolve) => setTimeout(() => resolve([]), 2000)),
  ]).catch(() => [] as string[]);

  console.log(
    "[voice/memory-search] query:",
    query.slice(0, 60),
    "memories:",
    memories.length,
  );

  return Response.json({
    text: memories.length
      ? memories.map((m) => `- ${m}`).join("\n")
      : NO_MEMORIES,
  });
}
