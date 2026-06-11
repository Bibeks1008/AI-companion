import { generateObject } from "ai";

import { getAnalysisModel } from "./provider";
import {
  buildPersonaAssignmentSystemPrompt,
  buildPersonaAssignmentUserPrompt,
} from "./prompts/persona-assignment";
import { analysisResultSchema, type AnalysisResult } from "@/validation/ai";

/**
 * Run the persona-assignment analysis. Uses the Vercel AI SDK `generateObject()`
 * with a Zod schema, so the result is structured and validated — no manual JSON
 * parsing. Provider-agnostic via getAnalysisModel(). Server-only.
 */
export async function analyzeOnboarding(
  formattedAnswers: string,
): Promise<AnalysisResult> {
  const { object } = await generateObject({
    model: getAnalysisModel(),
    schema: analysisResultSchema,
    system: buildPersonaAssignmentSystemPrompt(),
    prompt: buildPersonaAssignmentUserPrompt(formattedAnswers),
  });

  return object;
}
