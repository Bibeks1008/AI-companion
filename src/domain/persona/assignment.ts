import {
  FALLBACK_PERSONA_ID,
  getPersonaName,
  MIN_CONFIDENCE,
  type PersonaId,
} from "./personas";
import type { EmotionScore } from "@/domain/emotion/types";

/**
 * The model's raw analysis, before the business fallback rule is applied.
 */
export interface RawAnalysis {
  personaId: PersonaId;
  confidence: number;
  reasoning: string;
  emotions: EmotionScore[];
}

/**
 * The final, persistable assignment after applying PRD F-01.
 */
export interface PersonaAssignmentResult {
  personaId: PersonaId;
  personaName: string;
  confidence: number;
  reasoning: string;
  emotions: EmotionScore[];
  /** True when confidence was below threshold and we fell back to P1. */
  isFallback: boolean;
}

/**
 * Apply the persona-assignment business rule (PRD F-01):
 * if confidence < 60, default to P1 (The Gentle Listener) while preserving the
 * returned confidence score. Provider-agnostic and pure, so it is unit-testable
 * independent of any AI model.
 */
export function resolvePersonaAssignment(
  analysis: RawAnalysis,
): PersonaAssignmentResult {
  const isFallback = analysis.confidence < MIN_CONFIDENCE;
  const personaId = isFallback ? FALLBACK_PERSONA_ID : analysis.personaId;

  return {
    personaId,
    personaName: getPersonaName(personaId),
    confidence: analysis.confidence,
    reasoning: analysis.reasoning,
    emotions: analysis.emotions,
    isFallback,
  };
}
