import {
  getAnswerLabel,
  ONBOARDING_QUESTIONS,
} from "@/features/onboarding/config/questions";
import type { OnboardingAnswers } from "@/features/onboarding/schema";

/**
 * Render validated answers into a readable Q/A block for the AI prompt. Uses the
 * human-readable option labels (not raw stored values) so the model reasons over
 * meaningful text.
 */
export function formatAnswersForPrompt(answers: OnboardingAnswers): string {
  return ONBOARDING_QUESTIONS.map((q) => {
    const value = (answers as Record<string, unknown>)[q.key];
    return `Q: ${q.title}\nA: ${getAnswerLabel(q, value)}`;
  }).join("\n\n");
}
