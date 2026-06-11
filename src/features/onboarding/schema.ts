import { z } from "zod";

import {
  ONBOARDING_QUESTIONS,
  type Question,
} from "@/features/onboarding/config/questions";

/**
 * Per-question Zod validator derived from the typed question config. Keeping
 * validation data-driven means adding a question only requires editing
 * questions.ts — the schema follows automatically.
 */
function validatorForQuestion(question: Question): z.ZodType {
  switch (question.type) {
    case "single_select": {
      const values = question.options.map((o) => o.value);
      return z
        .string()
        .refine((v) => values.includes(v), { message: "Please pick an option." });
    }
    case "scale": {
      return z
        .number({ message: "Please choose a rating." })
        .int()
        .min(question.min)
        .max(question.max);
    }
    case "text": {
      const base = z.string().max(question.maxLength, {
        message: `Please keep it under ${question.maxLength} characters.`,
      });
      return question.required
        ? base.trim().min(1, { message: "Please share a little here." })
        : base;
    }
  }
}

export const answersSchema = z.object(
  Object.fromEntries(
    ONBOARDING_QUESTIONS.map((q) => [q.key, validatorForQuestion(q)]),
  ),
);

export type OnboardingAnswers = z.infer<typeof answersSchema>;

/** Question keys in order, used for stepping and per-step validation. */
export const QUESTION_KEYS = ONBOARDING_QUESTIONS.map((q) => q.key);

/** Loose shape for in-progress form state (values may be empty/undefined). */
export type OnboardingFormValues = Record<
  string,
  string | number | undefined
>;

/** Empty starting values for the form, typed per question. */
export function buildDefaultValues(): OnboardingFormValues {
  return Object.fromEntries(
    ONBOARDING_QUESTIONS.map((q) => [q.key, q.type === "scale" ? undefined : ""]),
  );
}

/**
 * Validate a single answer against its question's rule. Returns `true` when
 * valid, or the first error message — shaped for react-hook-form's `validate`.
 */
export function validateAnswer(
  question: Question,
  value: unknown,
): true | string {
  const result = validatorForQuestion(question).safeParse(value);
  if (result.success) return true;
  return result.error.issues[0]?.message ?? "Please complete this question.";
}
