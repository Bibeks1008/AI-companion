import { Loader2, Pencil } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  getAnswerLabel,
  ONBOARDING_QUESTIONS,
} from "@/features/onboarding/config/questions";
import type { OnboardingFormValues } from "@/features/onboarding/schema";

export function ReviewStep({
  values,
  onEdit,
  onSubmit,
  onBack,
  isSubmitting,
  error,
}: {
  values: OnboardingFormValues;
  onEdit: (questionIndex: number) => void;
  onSubmit: () => void;
  onBack: () => void;
  isSubmitting: boolean;
  error: string | null;
}) {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">
          Does this feel right?
        </h1>
        <p className="mt-2 text-muted-foreground">
          Review your answers before we find your companion.
        </p>
      </div>

      <ul className="space-y-3">
        {ONBOARDING_QUESTIONS.map((q, index) => (
          <li
            key={q.key}
            className="rounded-xl border bg-card px-4 py-3 text-card-foreground"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm text-muted-foreground">{q.title}</p>
                <p className="mt-0.5 font-medium">
                  {getAnswerLabel(q, values[q.key])}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="shrink-0 text-muted-foreground"
                onClick={() => onEdit(index)}
                disabled={isSubmitting}
              >
                <Pencil className="size-3.5" />
                Edit
              </Button>
            </div>
          </li>
        ))}
      </ul>

      {error && (
        <div className="mt-5 rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="mt-8 flex gap-3">
        <Button
          variant="outline"
          className="flex-1"
          onClick={onBack}
          disabled={isSubmitting}
        >
          Back
        </Button>
        <Button className="flex-1" onClick={onSubmit} disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="size-4 animate-spin" />}
          {isSubmitting ? "Finding…" : "Find my companion"}
        </Button>
      </div>
    </div>
  );
}
