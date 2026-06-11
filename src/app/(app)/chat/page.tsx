import { redirect } from "next/navigation";
import type { UIMessage } from "ai";

import { createClient } from "@/lib/supabase/server";
import { ChatWindow } from "@/features/chat/components/ChatWindow";
import type { PersonaRow } from "@/features/chat/actions";
import {
  LOGIN_ROUTE,
  ONBOARDING_ROUTE,
} from "@/constants/routes.constants";

export default async function ChatPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(LOGIN_ROUTE);

  const { data: profile } = await supabase
    .from("profiles")
    .select("onboarding_completed, active_persona_id")
    .eq("id", user.id)
    .single();

  if (!profile?.onboarding_completed || !profile.active_persona_id) {
    redirect(ONBOARDING_ROUTE);
  }

  // Load active persona and all personas in parallel.
  const [{ data: persona }, { data: allPersonas }] = await Promise.all([
    supabase
      .from("personas")
      .select("name, archetype")
      .eq("id", profile.active_persona_id)
      .single(),
    supabase
      .from("personas")
      .select("id, name, archetype, best_for, traits")
      .eq("is_active", true)
      .order("id"),
  ]);

  const personas: PersonaRow[] = allPersonas ?? [];

  // Load messages from the active (unended) session so history survives
  // a page refresh. Returns [] if no session exists yet; useChatSession will
  // create one on mount.
  let initialMessages: UIMessage[] = [];

  const { data: activeSession } = await supabase
    .from("sessions")
    .select("id")
    .eq("user_id", user.id)
    .is("ended_at", null)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (activeSession) {
    const { data: dbMessages } = await supabase
      .from("messages")
      .select("id, role, content")
      .eq("session_id", activeSession.id)
      .order("created_at", { ascending: true });

    if (dbMessages) {
      initialMessages = dbMessages.map((m) => ({
        id: m.id,
        role: m.role as "user" | "assistant",
        parts: [{ type: "text" as const, text: m.content }],
        metadata: {},
      }));
    }
  }

  return (
    <main className="flex h-dvh bg-background">
      <div className="flex flex-col flex-1 items-center">
        <div className="flex flex-col w-full max-w-3xl h-full">
          <ChatWindow
            personaName={persona?.name ?? "Your Companion"}
            personaArchetype={persona?.archetype ?? ""}
            activePersonaId={profile.active_persona_id}
            personas={personas}
            initialMessages={initialMessages}
          />
        </div>
      </div>
    </main>
  );
}
