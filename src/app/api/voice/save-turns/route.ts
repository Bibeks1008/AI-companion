import { createClient } from "@/lib/supabase/server";
import { mem0 } from "@/lib/ai/mem0";

/**
 * POST /api/voice/save-turns
 *
 * Persists voice chat turns to Supabase and mem0.
 * Called by ChatWindow after each [user, assistant] voice exchange.
 *
 * Mirrors the onFinish handler in /api/chat/route.ts — same DB insert + mem0.add() pattern.
 * The difference: /api/chat saves server-side automatically; voice turns come from
 * ElevenLabs WebSocket callbacks in the browser, so the browser must push them here.
 *
 * Body: { sessionId: string, turns: { role: "user"|"assistant", content: string }[] }
 */
export async function POST(req: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return new Response("Unauthorized", { status: 401 });

  let sessionId: string;
  let turns: { role: string; content: string }[];
  try {
    ({ sessionId, turns } = await req.json());
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  if (!sessionId || !Array.isArray(turns) || !turns.length) {
    return new Response("Missing sessionId or turns", { status: 400 });
  }

  // Verify the session belongs to the authenticated user.
  const { data: session } = await supabase
    .from("sessions")
    .select("id, user_id")
    .eq("id", sessionId)
    .eq("user_id", user.id)
    .single();

  if (!session) return new Response("Session not found", { status: 404 });

  // Persist turns to the messages table — same as /api/chat route.ts:62-75.
  const { error } = await supabase.from("messages").insert(
    turns.map((t) => ({
      session_id: sessionId,
      user_id: user.id,
      role: t.role,
      content: t.content,
    })),
  );

  if (error) {
    console.error("[voice/save-turns] DB insert failed:", error.message);
  }

  // Incremental mem0 extraction — fire-and-forget, same as /api/chat route.ts:80-83.
  const convoTurns = turns.filter(
    (t): t is { role: "user" | "assistant"; content: string } =>
      t.role === "user" || t.role === "assistant",
  );
  if (convoTurns.length) {
    mem0.add(user.id, convoTurns);
  }

  console.log("[voice/save-turns] saved", turns.length, "turns for session", sessionId);

  return Response.json({ ok: true });
}
