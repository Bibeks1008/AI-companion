/**
 * Onboarding questionnaire definition. Questions live here (typed config), not
 * hardcoded inside React components, so they can be edited/reordered freely and
 * are consumed uniformly by the UI, the Zod schema, and the AI prompt.
 *
 * Phase 1 uses mixed answer formats: single-select, a 1–5 scale, and one
 * free-text reflection. Add/remove questions by editing this array.
 */

export type QuestionType = "single_select" | "scale" | "text";

export interface SelectOption {
  value: string;
  label: string;
}

interface BaseQuestion {
  key: string;
  type: QuestionType;
  /** Short, conversational prompt shown as the step heading. */
  title: string;
  /** Optional supporting line under the title. */
  description?: string;
  required: boolean;
}

export interface SingleSelectQuestion extends BaseQuestion {
  type: "single_select";
  options: SelectOption[];
}

export interface ScaleQuestion extends BaseQuestion {
  type: "scale";
  min: number;
  max: number;
  minLabel: string;
  maxLabel: string;
}

export interface TextQuestion extends BaseQuestion {
  type: "text";
  placeholder?: string;
  maxLength: number;
}

export type Question = SingleSelectQuestion | ScaleQuestion | TextQuestion;

export const ONBOARDING_QUESTIONS: Question[] = [
  {
    key: "emotional_state",
    type: "single_select",
    title: "How have you been feeling, most days lately?",
    description: "There's no wrong answer — just whatever feels closest.",
    required: true,
    options: [
      { value: "calm", label: "Calm and content" },
      { value: "anxious", label: "Stressed or anxious" },
      { value: "low", label: "Low or down" },
      { value: "lonely", label: "Lonely or disconnected" },
      { value: "driven", label: "Motivated and driven" },
      { value: "numb", label: "Numb or running on empty" },
    ],
  },
  {
    key: "communication_preference",
    type: "single_select",
    title: "When you're talking something through, what helps most?",
    required: true,
    options: [
      { value: "heard", label: "Being heard without judgment" },
      { value: "encouraged", label: "Encouragement and a gentle push" },
      { value: "perspective", label: "Big-picture perspective" },
      { value: "casual", label: "Easygoing, friendly chat" },
      { value: "structure", label: "Practical steps and structure" },
    ],
  },
  {
    key: "primary_goal",
    type: "single_select",
    title: "What are you hoping a companion can help you with?",
    required: true,
    options: [
      { value: "process_emotions", label: "Processing difficult emotions" },
      { value: "confidence", label: "Building confidence and momentum" },
      { value: "meaning", label: "Finding meaning and perspective" },
      { value: "connection", label: "Feeling a little less alone" },
      { value: "habits", label: "Building better habits" },
    ],
  },
  {
    key: "stress_level",
    type: "scale",
    title: "How would you rate your stress right now?",
    required: true,
    min: 1,
    max: 5,
    minLabel: "Very low",
    maxLabel: "Very high",
  },
  {
    key: "companionship_expectation",
    type: "single_select",
    title: "What kind of presence feels right for you?",
    required: true,
    options: [
      { value: "soothing", label: "Gentle and soothing" },
      { value: "energizing", label: "Upbeat and energizing" },
      { value: "thoughtful", label: "Calm and thoughtful" },
      { value: "playful", label: "Warm and playful" },
      { value: "focused", label: "Focused and structured" },
    ],
  },
  {
    key: "reflection",
    type: "text",
    title: "What's been on your mind lately?",
    description: "A sentence or two is plenty. Say as much or as little as you like.",
    required: true,
    placeholder: "Lately I've been feeling…",
    maxLength: 600,
  },
];

/** Look up the human-readable label for a stored answer value. */
export function getAnswerLabel(question: Question, value: unknown): string {
  if (question.type === "single_select") {
    return (
      question.options.find((o) => o.value === value)?.label ?? String(value)
    );
  }
  if (question.type === "scale") {
    return `${value} / ${question.max}`;
  }
  return String(value ?? "");
}
