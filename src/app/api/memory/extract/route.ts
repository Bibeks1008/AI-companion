import { createClient } from "@/lib/supabase/server";
import { mem0 } from "@/lib/ai/mem0";

export async function POST(req: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  let sessionId: string | undefined;
  try {
    const body = await req.json();
    sessionId = body.sessionId;
  } catch {
    return new Response("Invalid request", { status: 400 });
  }

  if (!sessionId) return new Response("Invalid request", { status: 400 });

  // Verify ownership and that extraction hasn't already run.
  const { data: session } = await supabase
    .from("sessions")
    .select("id, memory_extracted")
    .eq("id", sessionId)
    .eq("user_id", user.id)
    .single();

  if (!session) return new Response("Session not found", { status: 404 });
  if (session.memory_extracted) return Response.json({ ok: true });

  // Fetch all messages for the session ordered by insertion time.
  const { data: rows } = await supabase
    .from("messages")
    .select("role, content")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });

  if (!rows?.length) return Response.json({ ok: true });

  // Pass messages in OpenAI conversation format so Mem0 can extract facts
  // correctly (e.g. "works night duty" → stored fact, retrieved next session).
  const messages = rows
    .filter((m): m is { role: "user" | "assistant"; content: string } =>
      m.role === "user" || m.role === "assistant",
    )
    .map((m) => ({ role: m.role, content: m.content }));

  // Fire memory extraction — silent fail by design.
  await mem0.add(user.id, messages);

  // Mark extraction done so we don't re-run on duplicate calls.
  await supabase
    .from("sessions")
    .update({ memory_extracted: true })
    .eq("id", sessionId)
    .eq("user_id", user.id);

  return Response.json({ ok: true });
}
