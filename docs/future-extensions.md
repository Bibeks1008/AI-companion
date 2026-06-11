# Future Extension Points

Phase 1 was built so later phases attach cleanly. This is where they plug in.

## Chat (Phase 2)

- **Data:** add `sessions (id, user_id, persona_id, started_at, ended_at, turn_count)` and `messages (id, session_id, role, content, created_at)`. Both reference `profiles`/`personas`, which already exist.
- **Code:** add `features/chat/`. Reuse `personas.system_prompt` (already seeded) for the system prompt and `lib/ai/provider.ts` for the model. Session bootstrap reads `profiles.active_persona_id` (already denormalized).
- **API:** Supabase Edge Functions live under `supabase/functions/` and can be added without touching app code.

## Memory (Phase 2)

- Add `memory (id, user_id, summary, version, updated_at)`; attach the existing `set_updated_at` trigger.
- Summarization runs as an Edge Function (CRON/pg_net) calling the same provider abstraction; the summary is prepended to the system prompt at session start.

## Voice (Phase 3)

- `personas.voice_id` already exists (nullable). Voice integration (ElevenLabs) attaches at the chat layer; no schema change to personas required beyond populating `voice_id`.

## Dashboard (Phase 3)

- Session history, emotion trends, and memory viewer read from `sessions`, `persona_assignments.emotions`, and `memory`. The emotion data model is already captured per assignment.

## Persona switching (Phase 2/3)

- `persona_assignments.user_initiated` distinguishes system vs. user-initiated assignments. A switch inserts a new assignment with `user_initiated = true` and updates `profiles.active_persona_id`. No schema change needed.

## Google OAuth

- Supabase Auth already supports it; add the provider in `config.toml` and a button on the login screen. The `@supabase/ssr` client/server/middleware setup is unchanged.

## Deliberately omitted: `onboarding_submissions`

A parent "one questionnaire run" table was **intentionally not added** in Phase 1
because onboarding is once-per-user, so there is exactly one submission per
user — `persona_assignments` already records the assignment event and
`onboarding_responses` (unique per user+question) already represents that
single submission.

**Add it when re-onboarding / versioned submissions arrive:** introduce
`onboarding_submissions (id, user_id, status, created_at, completed_at)` and a
nullable `submission_id` FK on `onboarding_responses` and `persona_assignments`.
Existing Phase-1 rows backfill into one synthetic submission per user, so
deferring costs nothing.

## Provider abstraction

`lib/ai/provider.ts` is the only place a model SDK is imported. Adding providers
(Anthropic, etc.) or per-task models means editing that one file; prompts
(`lib/ai/prompts/`), schemas (`validation/`), and domain rules (`domain/`) stay
provider-agnostic.
