import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return new Response("Unauthorized", { status: 401 });

  const agentId = process.env.NEXT_PUBLIC_ELEVENLABS_AGENT_ID;
  const apiKey = process.env.ELEVENLABS_API_KEY;

  if (!agentId || !apiKey) {
    return new Response("ElevenLabs not configured", { status: 500 });
  }

  const res = await fetch(
    `https://api.elevenlabs.io/v1/convai/conversation/get_signed_url?agent_id=${agentId}`,
    { headers: { "xi-api-key": apiKey } },
  );

  if (!res.ok) {
    console.error("[voice/signed-url] ElevenLabs API error:", res.status, await res.text());
    return new Response("Failed to get signed URL from ElevenLabs", { status: res.status });
  }

  const data = await res.json();
  return Response.json({ signedUrl: data.signed_url });
}
