"use client";

import { Controller, type Control } from "react-hook-form";

import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { Question } from "@/features/onboarding/config/questions";
import {
  validateAnswer,
  type OnboardingFormValues,
} from "@/features/onboarding/schema";

export function QuestionField({
  question,
  control,
}: {
  question: Question;
  control: Control<OnboardingFormValues>;
}) {
  return (
    <Controller
      name={question.key}
      control={control}
      rules={{ validate: (v) => validateAnswer(question, v) }}
      render={({ field, fieldState }) => (
        <div>
          {question.type === "single_select" && (
            <RadioGroup
              value={(field.value as string) ?? ""}
              onValueChange={field.onChange}
              className="gap-3"
            >
              {question.options.map((option) => {
                const selected = field.value === option.value;
                return (
                  <label
                    key={option.value}
                    htmlFor={`${question.key}-${option.value}`}
                    className={cn(
                      "flex cursor-pointer items-center gap-3 rounded-xl border bg-card px-4 py-3.5 text-card-foreground transition-colors",
                      selected
                        ? "border-primary ring-2 ring-primary/30"
                        : "hover:border-primary/40",
                    )}
                  >
                    <RadioGroupItem
                      id={`${question.key}-${option.value}`}
                      value={option.value}
                    />
                    <span className="text-sm font-medium">{option.label}</span>
                  </label>
                );
              })}
            </RadioGroup>
          )}

          {question.type === "scale" && (
            <div>
              <div className="flex gap-2">
                {Array.from(
                  { length: question.max - question.min + 1 },
                  (_, i) => question.min + i,
                ).map((n) => {
                  const selected = field.value === n;
                  return (
                    <button
                      key={n}
                      type="button"
                      onClick={() => field.onChange(n)}
                      aria-pressed={selected}
                      className={cn(
                        "flex h-12 flex-1 items-center justify-center rounded-xl border text-base font-medium transition-colors",
                        selected
                          ? "border-primary bg-primary text-primary-foreground"
                          : "bg-card hover:border-primary/40",
                      )}
                    >
                      {n}
                    </button>
                  );
                })}
              </div>
              <div className="mt-2 flex justify-between text-xs text-muted-foreground">
                <span>{question.minLabel}</span>
                <span>{question.maxLabel}</span>
              </div>
            </div>
          )}

          {question.type === "text" && (
            <div>
              <Textarea
                value={(field.value as string) ?? ""}
                onChange={field.onChange}
                onBlur={field.onBlur}
                placeholder={question.placeholder}
                maxLength={question.maxLength}
                rows={5}
                aria-invalid={!!fieldState.error}
                className="resize-none"
              />
              <p className="mt-1.5 text-right text-xs text-muted-foreground">
                {((field.value as string) ?? "").length}/{question.maxLength}
              </p>
            </div>
          )}

          {fieldState.error && (
            <p className="mt-2 text-sm text-destructive">
              {fieldState.error.message}
            </p>
          )}
        </div>
      )}
    />
  );
}
