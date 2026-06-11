# Architecture Overview

## Stack

- **Next.js 16 (App Router) + React 19** — UI, server components, server actions, route handlers.
- **Supabase** — Postgres, Auth (magic link), Row Level Security, migrations. The complete backend; there is no separate API server.
- **Vercel AI SDK + OpenAI** — server-side emotion/persona analysis via `generateObject()` with Zod schemas.
- **Tailwind v4 + shadcn/ui (new-york)** — design system and primitives.
- **Zod** — validation for AI output and form input.

## Layering

The codebase enforces a clear separation so concerns stay swappable:

```
UI (React components, app/ pages)
   │  calls server actions / reads via server clients
Domain logic (src/domain) ──── pure, framework-agnostic business rules
   │
AI logic (src/lib/ai) ──────── provider-abstracted model calls + prompts
   │
Validation (src/validation, feature schema.ts) ── Zod contracts
   │
Data access (src/lib/supabase) ── typed Supabase clients (RLS-enforced)
```

Key rules:

- **No business logic in components.** Submission, analysis, and persistence run in a server action (`features/onboarding/actions.ts`); components consume typed results.
- **No provider leakage.** Components and domain code never import OpenAI directly — they go through `lib/ai/provider.ts`. Switching to Claude is a one-line change there.
- **RLS is the security boundary.** Server clients act as the signed-in user (anon key + cookies); the service-role key is never used in app flows.
- **Generated DB types are the source of truth.** `src/types/database.ts` is produced by `npm run db:types` and never hand-edited.

## Request / data flow (Phase 1)

1. **Sign-in** — user submits email; the browser Supabase client sends a magic link (`signInWithOtp`). The link returns to `/(auth)/callback`, which exchanges the code for a session (cookies written by `@supabase/ssr`).
2. **Middleware** (`middleware.ts` → `lib/supabase/middleware.ts`) refreshes the session on every request and applies coarse route protection.
3. **Onboarding** — the multi-step questionnaire (client) collects answers; on submit the `submitOnboarding` server action validates them with Zod.
4. **AI analysis** — the action calls `analyzeOnboarding()` which runs `generateObject()` against the persona-assignment prompt and Zod schema.
5. **Business rule** — `resolvePersonaAssignment()` applies the PRD F-01 fallback (confidence < 60 ⇒ P1).
6. **Persistence** — answers, the assignment (incl. `reasoning`), and the profile's completion state + active persona are written under RLS.
7. **Result** — the action redirects to `/result`, a server component that reads the active persona + latest assignment and renders the result card.

## Auth model

Supabase Auth with magic link (email OTP). Google OAuth is structurally
supported by Supabase and can be added later without changing the client/server
client setup. `auth.users` is owned by Supabase; an `on_auth_user_created`
trigger provisions a matching `public.profiles` row.
