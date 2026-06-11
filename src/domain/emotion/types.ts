/**
 * A single inferred emotion with a normalized intensity score in [0, 1].
 * Stored as JSONB in persona_assignments.emotions.
 */
export interface EmotionScore {
  name: string;
  score: number;
}
