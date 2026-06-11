import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/session/end
 *
 * Stamps ended_at on the session and fires memory extraction.
 * Called via navigator.sendBeacon() on tab/window close so the request
 * is guaranteed to complete even after the page is killed — unlike the
 * endSession() server action whose fetch is aborted on unload.
 */
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

  const { error } = await supabase
    .from("sessions")
    .update({ ended_at: new Date().toISOString() })
    .eq("id", sessionId)
    .eq("user_id", user.id)
    .is("ended_at", null);

  if (error) return new Response("Failed to end session", { status: 500 });

  // Fire memory extraction fire-and-forget — identical path to endSession().
  const host = req.headers.get("host") ?? "localhost:3000";
  const protocol = host.startsWith("localhost") ? "http" : "https";
  fetch(`${protocol}://${host}/api/memory/extract`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: req.headers.get("cookie") ?? "",
    },
    body: JSON.stringify({ sessionId }),
  }).catch(() => {});

  return new Response(null, { status: 204 });
}
