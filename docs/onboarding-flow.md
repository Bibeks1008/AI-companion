# Onboarding Flow

## Screens

```
Welcome → Question 1..N (one per step) → Review → Analyzing → Result
```

- **Welcome** (`welcome-step.tsx`) — short, reassuring intro and a "Begin" CTA.
- **Questionnaire** (`onboarding-flow.tsx` + `question-field.tsx`) — one question per step with a `ProgressIndicator` (Step n/N), Back/Next, and per-step Zod validation. Mixed answer formats: single-select, a 1–5 scale, and one free-text reflection.
- **Review** (`review-step.tsx`) — all answers summarized with an Edit jump back to any step.
- **Analyzing** (`analyzing-state.tsx`) — calm loading state during the AI round-trip; on failure the user is returned to Review with an inline error + retry.
- **Result** — see [persona-assignment.md](./persona-assignment.md).

## Questions are configuration, not code

All questions live in `features/onboarding/config/questions.ts` as a typed array
— never hardcoded inside components. Each question declares its `type`
(`single_select` | `scale` | `text`), label, and constraints. From that single
source:

- the **UI** renders the right input (`question-field.tsx`),
- the **Zod schema** is derived automatically (`schema.ts` → `answersSchema`, `validateAnswer`),
- the **AI prompt** is formatted from the same labels (`format.ts`).

Adding, removing, or reordering a question means editing only `questions.ts`.

## Validation

`schema.ts` builds a per-question validator from the config. The form uses
`react-hook-form`; each field validates on `Next` via `form.trigger(key)` and
the same rules re-run server-side in the action (`answersSchema.safeParse`) — the
client is never trusted.

## Submission (server action)

`features/onboarding/actions.ts → submitOnboarding`:

1. Resolve the signed-in user (redirect to login if absent).
2. Short-circuit to `/result` if already onboarded (once-per-user).
3. `answersSchema.safeParse` the answers.
4. `analyzeOnboarding(formatAnswersForPrompt(answers))` → structured analysis.
5. `resolvePersonaAssignment(analysis)` → applies the P1 fallback rule.
6. Persist: upsert `onboarding_responses`, insert `persona_assignments` (with `reasoning`), update `profiles` (`onboarding_completed`, `onboarding_completed_at`, `active_persona_id`).
7. `redirect('/result')`.

Any failure returns `{ error }` (no redirect) so the UI can show a retry; a
successful run redirects and the result page reads the persisted data.

## Once-per-user

Enforced in three places: the onboarding page guard, the action guard, and the
`profiles.onboarding_completed` flag. For local testing, reset with
`npm run db:reset`.
