/**
 * Canonical persona roster (Phase 1). This is the source of truth the AI prompt
 * is built from, kept in sync with the `personas` table seeded by
 * supabase/seed.sql. The DB holds the full system prompts; this module holds the
 * lightweight identity + selection guidance the model needs to choose between
 * them.
 */

export const PERSONA_IDS = ["P1", "P2", "P3", "P4", "P5"] as const;

export type PersonaId = (typeof PERSONA_IDS)[number];

/** Persona used when confidence is too low to commit to a match (PRD F-01). */
export const FALLBACK_PERSONA_ID: PersonaId = "P1";

/** Minimum confidence (inclusive) required to keep the AI's chosen persona. */
export const MIN_CONFIDENCE = 60;

export interface PersonaDefinition {
  id: PersonaId;
  name: string;
  archetype: string;
  bestFor: string;
}

export const PERSONAS: Record<PersonaId, PersonaDefinition> = {
  P1: {
    id: "P1",
    name: "The Gentle Listener",
    archetype: "Warm, non-judgmental",
    bestFor: "Emotional processing, grief, anxiety, stress",
  },
  P2: {
    id: "P2",
    name: "The Motivator",
    archetype: "Energetic, goal-oriented",
    bestFor: "Productivity, confidence, momentum, goals",
  },
  P3: {
    id: "P3",
    name: "The Sage",
    archetype: "Calm, philosophical",
    bestFor: "Perspective, meaning-making, self-discovery, reflection",
  },
  P4: {
    id: "P4",
    name: "The Buddy",
    archetype: "Casual, humorous, peer-like",
    bestFor: "Loneliness, daily chat, social connection",
  },
  P5: {
    id: "P5",
    name: "The Coach",
    archetype: "Structured, CBT-informed",
    bestFor: "Habit building, negative thought patterns, behavior change",
  },
};

export const PERSONA_LIST: PersonaDefinition[] = PERSONA_IDS.map(
  (id) => PERSONAS[id],
);

export function getPersonaName(id: PersonaId): string {
  return PERSONAS[id].name;
}
