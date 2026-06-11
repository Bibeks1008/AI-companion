"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { analyzeOnboarding } from "@/lib/ai/analyze-onboarding";
import { resolvePersonaAssignment } from "@/domain/persona/assignment";
import { answersSchema } from "@/features/onboarding/schema";
import { formatAnswersForPrompt } from "@/features/onboarding/format";
import { LOGIN_ROUTE, RESULT_ROUTE } from "@/constants/routes.constants";

type ActionError = { error: string };

/**
 * Submit onboarding: validate answers, run AI analysis, apply the persona
 * fallback rule, persist everything, then redirect to the result screen.
 * Returns an `{ error }` object on failure (no redirect) so the client can
 * surface a retry. On success it redirects and never returns.
 */
export async function submitOnboarding(
  raw: unknown,
): Promise<ActionError | void> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(LOGIN_ROUTE);

  // Already onboarded? Don't re-run; go straight to the result.
  const { data: profile } = await supabase
    .from("profiles")
    .select("onboarding_completed")
    .eq("id", user.id)
    .single();
  if (profile?.onboarding_completed) redirect(RESULT_ROUTE);

  // Validate answers server-side (never trust the client).
  const parsed = answersSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: "Some answers look incomplete. Please review and resubmit." };
  }
  const answers = parsed.data;

  // AI analysis + business fallback rule (PRD F-01).
  let assignment;
  try {
    const analysis = await analyzeOnboarding(formatAnswersForPrompt(answers));
    assignment = resolvePersonaAssignment(analysis);
  } catch {
    return {
      error:
        "We couldn't analyze your answers just now. Please try again in a moment.",
    };
  }

  // Persist raw answers (one row per question), the assignment, and profile state.
  const responseRows = Object.entries(answers).map(([question_key, answer]) => ({
    user_id: user.id,
    question_key,
    answer: answer as never,
  }));

  const { error: responsesError } = await supabase
    .from("onboarding_responses")
    .upsert(responseRows, { onConflict: "user_id,question_key" });
  if (responsesError) return { error: "Could not save your answers." };

  const { error: assignmentError } = await supabase
    .from("persona_assignments")
    .insert({
      user_id: user.id,
      persona_id: assignment.personaId,
      confidence: assignment.confidence,
      emotions: assignment.emotions as never,
      reasoning: assignment.reasoning,
      user_initiated: false,
    });
  if (assignmentError) return { error: "Could not save your match." };

  const { error: profileError } = await supabase
    .from("profiles")
    .update({
      onboarding_completed: true,
      onboarding_completed_at: new Date().toISOString(),
      active_persona_id: assignment.personaId,
    })
    .eq("id", user.id);
  if (profileError) return { error: "Could not finish onboarding." };

  redirect(RESULT_ROUTE);
}
