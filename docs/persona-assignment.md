# Persona Assignment Flow

## Personas (Phase 1)

| ID | Name | Archetype | Best for |
|----|------|-----------|----------|
| P1 | The Gentle Listener | Warm, non-judgmental | Emotional processing, grief, anxiety |
| P2 | The Motivator | Energetic, goal-oriented | Productivity, confidence, ambition |
| P3 | The Sage | Calm, philosophical | Meaning-making, perspective, reflection |
| P4 | The Buddy | Casual, humorous, peer-like | Loneliness, social anxiety, daily chat |
| P5 | The Coach | Structured, CBT-informed | Habit building, negative thought patterns |

The roster exists in two synced places: `domain/persona/personas.ts` (the
identity/selection data the prompt is built from) and `supabase/seed.sql` (the
DB rows, including full `system_prompt`s for Phase 2 chat).

## Pipeline

```
answers → formatAnswersForPrompt()        (features/onboarding/format.ts)
        → analyzeOnboarding()             (lib/ai/analyze-onboarding.ts)
            • getAnalysisModel()          (lib/ai/provider.ts → openai('gpt-4o-mini'))
            • generateObject({ schema })  (validation/ai.ts → analysisResultSchema)
        → resolvePersonaAssignment()      (domain/persona/assignment.ts)
        → persist + redirect              (features/onboarding/actions.ts)
```

## AI output contract

`generateObject()` is constrained by `analysisResultSchema` (Zod) — no manual
JSON parsing. Shape:

```jsonc
{
  "personaId": "P1",
  "confidence": 82,                 // integer 0–100
  "reasoning": "You want a calm, non-judgmental space to process anxiety.",
  "emotions": [{ "name": "anxiety", "score": 0.82 }]
}
```

`reasoning` is shown to the user on the result card. `personaName` is resolved
from `personaId` server-side (not trusted from the model).

## Fallback rule (PRD F-01)

`resolvePersonaAssignment()` is pure, provider-agnostic, and unit-testable:

> If `confidence < 60`, assign **P1 (The Gentle Listener)** while preserving the
> returned confidence; flag the result as a fallback.

The result card shows gentle framing when `isFallback` is true.

## Result screen

`features/persona/queries.ts → getPersonaResult()` reads the profile's
`active_persona_id`, the matching persona row, and the latest
`persona_assignments` row, returning a `PersonaResultView`. `PersonaResultCard`
renders the persona name/archetype/description, the AI `reasoning`, emotion
chips, and the confidence. The primary CTA is a Phase-1 placeholder (chat is a
future phase).

## Swapping to Claude

Change `lib/ai/provider.ts` to return `anthropic('claude-...')` and set the
provider env var. Nothing else changes — the prompt, schema, fallback rule, and
persistence are provider-agnostic.
