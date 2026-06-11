"use server";

import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";

import { createClient } from "@/lib/supabase/server";
import { LOGIN_ROUTE } from "@/constants/routes.constants";

type SessionResult = { sessionId: string; voiceId: string | null };
type ActionError = { error: string };

export interface PersonaRow {
  id: string;
  name: string;
  archetype: string;
  best_for: string;
  traits: string[];
}

/**
 * Start a chat session for the authenticated user.
 *
 * Idempotent: if an unended session already exists, returns its ID rather than
 * creating a duplicate. Snapshots system_prompt and voice_id from the active
 * persona so the session remains consistent even if the persona is updated later.
 */
export async function startSession(): Promise<SessionResult | ActionError> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(LOGIN_ROUTE);

  // Idempotent: return the open session if one already exists.
  const { data: existing } = await supabase
    .from("sessions")
    .select("id, voice_id")
    .eq("user_id", user.id)
    .is("ended_at", null)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) return { sessionId: existing.id, voiceId: existing.voice_id };

  // Resolve active persona from profile.
  const { data: profile } = await supabase
    .from("profiles")
    .select("active_persona_id")
    .eq("id", user.id)
    .single();

  if (!profile?.active_persona_id) {
    return { error: "No active persona assigned. Please complete onboarding first." };
  }

  // Snapshot the persona's prompt and voice at session start time.
  const { data: persona } = await supabase
    .from("personas")
    .select("system_prompt, voice_id")
    .eq("id", profile.active_persona_id)
    .single();

  if (!persona) {
    return { error: "Persona not found." };
  }

  const { data: session, error } = await supabase
    .from("sessions")
    .insert({
      user_id: user.id,
      persona_id: profile.active_persona_id,
      system_prompt: persona.system_prompt,
      voice_id: persona.voice_id,
    })
    .select("id")
    .single();

  if (error || !session) {
    return { error: "Failed to start session. Please try again." };
  }

  return { sessionId: session.id, voiceId: persona.voice_id };
}

/**
 * End an active session by recording the end timestamp, then triggers
 * fire-and-forget memory extraction via /api/memory/extract.
 *
 * Uses an absolute URL built from the incoming Host header — relative
 * fetch() paths fail in Node.js server actions.
 */
export async function endSession(sessionId: string): Promise<ActionError | void> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(LOGIN_ROUTE);

  const { error } = await supabase
    .from("sessions")
    .update({ ended_at: new Date().toISOString() })
    .eq("id", sessionId)
    .eq("user_id", user.id)
    .is("ended_at", null);

  if (error) {
    return { error: "Failed to end session. Please try again." };
  }

  // Fire-and-forget: trigger memory extraction without blocking the response.
  const [headerStore, cookieStore] = await Promise.all([headers(), cookies()]);
  const host = headerStore.get("host") ?? "localhost:3000";
  const protocol = host.startsWith("localhost") ? "http" : "https";
  const cookieHeader = cookieStore
    .getAll()
    .map(({ name, value }) => `${name}=${value}`)
    .join("; ");
  fetch(`${protocol}://${host}/api/memory/extract`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookieHeader },
    body: JSON.stringify({ sessionId }),
  }).catch(() => {
    // best-effort — never let extraction failure surface to the user
  });
}

/**
 * Switch the authenticated user's active persona.
 *
 * Updates profiles.active_persona_id and records the switch in
 * persona_assignments with user_initiated = true.
 * The caller is responsible for refreshing the page to start a new session.
 */
export async function switchPersona(newPersonaId: string): Promise<ActionError | void> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(LOGIN_ROUTE);

  // Verify the target persona is active.
  const { data: persona } = await supabase
    .from("personas")
    .select("id")
    .eq("id", newPersonaId)
    .eq("is_active", true)
    .single();

  if (!persona) {
    return { error: "Persona not found or inactive." };
  }

  // Update active persona on profile.
  const { error: profileError } = await supabase
    .from("profiles")
    .update({ active_persona_id: newPersonaId })
    .eq("id", user.id);

  if (profileError) {
    return { error: "Failed to switch persona. Please try again." };
  }

  // Record the user-initiated switch.
  const { error: assignError } = await supabase.from("persona_assignments").insert({
    user_id: user.id,
    persona_id: newPersonaId,
    confidence: 100,
    emotions: [],
    reasoning: "User switched manually",
    user_initiated: true,
  });

  if (assignError) {
    return { error: "Failed to record persona switch." };
  }
}
