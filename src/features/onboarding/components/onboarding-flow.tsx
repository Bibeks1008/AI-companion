"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { ONBOARDING_QUESTIONS } from "@/features/onboarding/config/questions";
import {
  buildDefaultValues,
  type OnboardingFormValues,
} from "@/features/onboarding/schema";
import { submitOnboarding } from "@/features/onboarding/actions";
import { ProgressIndicator } from "./progress-indicator";
import { QuestionField } from "./question-field";
import { WelcomeStep } from "./welcome-step";
import { ReviewStep } from "./review-step";
import { AnalyzingState } from "./analyzing-state";

type Phase = "welcome" | "questions" | "review" | "analyzing";

const TOTAL = ONBOARDING_QUESTIONS.length;

export function OnboardingFlow() {
  const [phase, setPhase] = useState<Phase>("welcome");
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<OnboardingFormValues>({
    defaultValues: buildDefaultValues(),
    mode: "onTouched",
  });

  const question = ONBOARDING_QUESTIONS[step];

  async function handleNext() {
    const valid = await form.trigger(question.key);
    if (!valid) return;
    if (step < TOTAL - 1) {
      setStep((s) => s + 1);
    } else {
      setPhase("review");
    }
  }

  function handleBack() {
    if (step === 0) {
      setPhase("welcome");
    } else {
      setStep((s) => s - 1);
    }
  }

  function handleEdit(index: number) {
    setStep(index);
    setPhase("questions");
  }

  async function handleSubmit() {
    setError(null);
    setPhase("analyzing");
    const result = await submitOnboarding(form.getValues());
    // A successful submit redirects server-side; we only get here on failure.
    if (result?.error) {
      setError(result.error);
      setPhase("review");
    }
  }

  if (phase === "welcome") {
    return <WelcomeStep onBegin={() => setPhase("questions")} />;
  }

  if (phase === "analyzing") {
    return <AnalyzingState />;
  }

  if (phase === "review") {
    return (
      <ReviewStep
        values={form.getValues()}
        onEdit={handleEdit}
        onSubmit={handleSubmit}
        onBack={() => {
          setStep(TOTAL - 1);
          setPhase("questions");
        }}
        isSubmitting={false}
        error={error}
      />
    );
  }

  // phase === "questions"
  return (
    <div>
      <ProgressIndicator current={step + 1} total={TOTAL} />
      <div key={question.key}>
        <h1 className="text-2xl font-semibold tracking-tight">
          {question.title}
        </h1>
        {question.description && (
          <p className="mt-2 text-muted-foreground">{question.description}</p>
        )}
        <div className="mt-6">
          <QuestionField question={question} control={form.control} />
        </div>
      </div>

      <div className="mt-8 flex gap-3">
        <Button variant="outline" className="flex-1" onClick={handleBack}>
          Back
        </Button>
        <Button className="flex-1" onClick={handleNext}>
          {step < TOTAL - 1 ? "Next" : "Review"}
        </Button>
      </div>
    </div>
  );
}
