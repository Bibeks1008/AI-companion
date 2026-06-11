import { z } from "zod";

import { PERSONA_IDS } from "@/domain/persona/personas";

/**
 * Schema the AI model must conform to when assigning a persona. Used directly by
 * the Vercel AI SDK `generateObject()` call — no manual JSON parsing. The shape
 * matches the PRD output contract plus a user-facing `reasoning` string.
 */
export const emotionScoreSchema = z.object({
  name: z
    .string()
    .describe("Lowercase emotion label, e.g. 'anxiety', 'hope', 'loneliness'."),
  score: z
    .number()
    .min(0)
    .max(1)
    .describe("Intensity from 0 (absent) to 1 (very strong)."),
});

export const analysisResultSchema = z.object({
  personaId: z
    .enum(PERSONA_IDS)
    .describe("The single best-matched persona id (P1–P5)."),
  confidence: z
    .number()
    .int()
    .min(0)
    .max(100)
    .describe("Confidence in the match, 0–100."),
  reasoning: z
    .string()
    .min(1)
    .describe(
      "1–2 warm, second-person sentences explaining why this persona fits, shown to the user.",
    ),
  emotions: z
    .array(emotionScoreSchema)
    .min(1)
    .max(5)
    .describe("Top inferred emotions, most prominent first."),
});

export type AnalysisResult = z.infer<typeof analysisResultSchema>;
