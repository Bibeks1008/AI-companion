import { createClient } from "@/lib/supabase/server";
import type { EmotionScore } from "@/domain/emotion/types";
import { MIN_CONFIDENCE, type PersonaId } from "@/domain/persona/personas";

export interface PersonaResultView {
  persona: {
    id: PersonaId;
    name: string;
    archetype: string;
    description: string;
    traits: string[];
  };
  confidence: number;
  reasoning: string;
  emotions: EmotionScore[];
  isFallback: boolean;
}

/**
 * Load the signed-in user's active persona and their latest assignment, shaped
 * for the result screen. Returns null when there is no completed assignment yet.
 */
export async function getPersonaResult(): Promise<PersonaResultView | null> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("active_persona_id")
    .eq("id", user.id)
    .single();

  if (!profile?.active_persona_id) return null;

  const [{ data: persona }, { data: assignment }] = await Promise.all([
    supabase
      .from("personas")
      .select("id, name, archetype, description, traits")
      .eq("id", profile.active_persona_id)
      .single(),
    supabase
      .from("persona_assignments")
      .select("confidence, reasoning, emotions")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .single(),
  ]);

  if (!persona || !assignment) return null;

  return {
    persona: {
      id: persona.id as PersonaId,
      name: persona.name,
      archetype: persona.archetype,
      description: persona.description,
      traits: persona.traits ?? [],
    },
    confidence: assignment.confidence,
    reasoning: assignment.reasoning,
    emotions: (assignment.emotions as EmotionScore[] | null) ?? [],
    isFallback: assignment.confidence < MIN_CONFIDENCE,
  };
}
