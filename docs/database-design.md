# Database Design

All schema changes are migration-driven (`supabase/migrations/`). Nothing is
created through the dashboard. RLS is enabled on every table.

## Tables (Phase 1)

### `personas` — reference data (5 rows)
The companion archetypes. `system_prompt` is a **column**, so prompts can be
iterated by re-running `seed.sql` — no migration required.

| Column | Type | Notes |
|---|---|---|
| `id` | text PK | `P1`–`P5` |
| `name`, `archetype`, `description` | text | display |
| `system_prompt` | text | injected at chat time (Phase 2) |
| `best_for` | text | selection hint |
| `traits` | text[] | display chips |
| `voice_id` | text null | reserved for voice (Phase 3) |
| `is_active` | bool | RLS exposes only active personas |
| `created_at`, `updated_at` | timestamptz | `updated_at` auto-maintained |

### `profiles` — 1:1 with `auth.users`
App-level user row. Auto-created on signup by the `handle_new_user` trigger.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK → `auth.users.id` | cascade delete |
| `email` | text | copied at signup |
| `onboarding_completed` | bool | enforces once-per-user onboarding |
| `onboarding_completed_at` | timestamptz null | set when onboarding succeeds |
| `active_persona_id` | text → personas | denormalized "current persona" |
| `created_at`, `updated_at` | timestamptz | `updated_at` auto-maintained |

### `onboarding_responses` — raw answers (audit)
One row per `(user, question_key)`. `answer` is JSONB so a single column covers
choice / scale / free-text uniformly. `unique (user_id, question_key)` makes
re-submission an upsert.

### `persona_assignments` — assignment audit log
One row per assignment. The source of truth for "what persona, and why".

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid → profiles | cascade delete |
| `persona_id` | text → personas | |
| `confidence` | int 0–100 | check constraint |
| `emotions` | jsonb | `[{ "name", "score" }]` |
| `reasoning` | text | AI's user-facing "why" |
| `user_initiated` | bool | false = system-assigned at onboarding |
| `created_at` | timestamptz | history is immutable |

## Triggers

- **`on_auth_user_created`** (`handle_new_user`, `security definer`) — inserts a `profiles` row for each new `auth.users` row.
- **`set_updated_at`** — one shared function attached to `profiles` and `personas`; `updated_at` is maintained in the database, never in app code. Future tables with `updated_at` attach the same trigger.

## RLS summary

| Table | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| `personas` | active rows, authenticated | — | — | — |
| `profiles` | own row | via trigger | own row | — |
| `onboarding_responses` | own rows | own rows | own rows | own rows |
| `persona_assignments` | own rows | own rows | — | — |

Personas are read-only reference data (writes only via seed / service role).
Every user table is owner-scoped via `auth.uid()`, so a user can never read or
write another user's data.

## Indexes

- `onboarding_responses (user_id)`
- `persona_assignments (user_id, created_at desc)` — latest-assignment lookup
- `profiles (active_persona_id)`

## Designed for future phases

`sessions`, `messages`, and `memory` (Phase 2) reference `profiles` and
`personas` — already the parents here — so they attach without redesign. See
[future-extensions.md](./future-extensions.md), including the deliberate
omission of an `onboarding_submissions` table for Phase 1.
