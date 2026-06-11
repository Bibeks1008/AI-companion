# AI Companion — Documentation

Phase 1 of the AI Companion app: the loop from **sign-in → onboarding → AI
emotion analysis → persona assignment → persistence → result screen**. Chat,
memory, voice, dashboard, and persona switching are intentionally out of scope
and planned for later phases.

## Contents

- [Architecture overview](./architecture.md)
- [Folder structure](./folder-structure.md)
- [Database design](./database-design.md)
- [Onboarding flow](./onboarding-flow.md)
- [Persona assignment flow](./persona-assignment.md)
- [Future extension points](./future-extensions.md)

## Quick start (local)

Prerequisites: Docker running, Supabase CLI installed, the project linked.

```bash
# 1. Bring up local Supabase, apply migrations, seed the 5 personas
npm run db:reset            # = supabase db reset

# 2. Generate typed DB client types (source of truth; never hand-edited)
npm run db:types            # writes src/types/database.ts

# 3. Configure environment (see below), then run the app
npm run dev
```

### Environment variables

| Variable | Where | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | client + server | Local: `http://127.0.0.1:54321` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | client + server | Anon key from `supabase status` |
| `OPENAI_API_KEY` | server only | Used by the AI analysis (Vercel AI SDK) |
| `AI_ANALYSIS_MODEL` | server only (optional) | Defaults to `gpt-4o-mini` |

The OpenAI key is read only inside server-side code (server actions); it never
reaches the browser.

### Magic-link sign-in locally

Emails are captured by the local mail server (Mailpit/Inbucket) — open the
Supabase email testing UI (`http://127.0.0.1:54324`) to click the link.
