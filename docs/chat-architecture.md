# Phase 2 Chat Architecture

## Overview

Three capabilities built in this order:

1. **Text Chat** — fetch active persona system_prompt, stream GPT-4o-mini response, persist turns
2. **Memory** — Mem0 semantic search before each call, post-session extraction
3. **Voice** — ElevenLabs STT → text → chat pipeline → ElevenLabs TTS → playback

Each layer builds on the proven layer below it.

---

## Key Architecture Decisions

### Memory retrieval: Next.js server action (not Supabase Edge Function)

Same pattern as onboarding: `OPENAI_API_KEY` and `MEM0_API_KEY` stay server-only without extra config, Vercel AI SDK `streamText` is native to server actions, and streaming to the browser works out of the box. An Edge Function would require duplicating secrets, adding a network hop, and working around streaming limitations. Defer Edge Functions until there is a non-Next.js client (e.g. mobile app).

### Memory extraction: fire-and-forget Route Handler

Session end server action saves the final message to DB, then calls `fetch('/api/memory/extract', { method: 'POST', body: JSON.stringify({ sessionId }) })` **without await** and immediately returns to the client. The Route Handler builds the session transcript and calls Mem0 in the background. Memory extraction is best-effort — if it fails silently, the user's next session simply has slightly less context.

### ElevenLabs STT is file upload, not real-time

The ElevenLabs STT API accepts an audio blob via multipart POST — it is not a streaming transcription service. UI flow: record → stop → upload → "transcribing…" → text → chat pipeline. Do not design for real-time captions.

### Persona snapshot on session

Store `system_prompt` as a column on the `sessions` row at session start. If the persona changes later (future feature), old sessions still replay correctly and the memory extraction uses the right prompt context.

---

## Request Flow

```
Browser
  │
  ├── Text input  OR
  ├── Voice input:
  │     record audio → stop → POST /api/voice/transcribe
  │                                └── ElevenLabs STT → { text }
  │
  ▼
useChat (Vercel AI SDK) → server action: sendMessage(sessionId, text)
  │
  ├── Promise.all([
  │     Mem0.search(userId, text),        ← parallel
  │     getRecentMessages(sessionId, 20)  ← parallel
  │   ])
  │
  ▼
streamText({
  model: gpt-4o-mini,
  system: persona.system_prompt + memory block,
  messages: [...history, { role: 'user', content: text }]
})
  │
  ├── stream chunks → browser (text renders token-by-token)
  ├── on stream complete → DB insert: user message + assistant message
  │
  ▼  [voice mode only]
POST /api/voice/speak → ElevenLabs TTS → Blob URL → <audio>.play()

Session end:
  endSession() server action → sets ended_at
  └── fetch('/api/memory/extract', { sessionId }) — no await
        └── Route Handler: transcript → Mem0.add(userId, transcript)
```

---

## Database Migration

File: `supabase/migrations/20260608120005_chat.sql`

```sql
create table public.sessions (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.profiles(id) on delete cascade,
  persona_id       text not null references public.personas(id),
  system_prompt    text not null,    -- snapshot at session start
  started_at       timestamptz not null default now(),
  ended_at         timestamptz,
  memory_extracted boolean not null default false,
  created_at       timestamptz not null default now()
);

create table public.messages (
  id         uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  role       text not null check (role in ('user', 'assistant')),
  content    text not null,
  created_at timestamptz not null default now()
);

create index on public.sessions (user_id, started_at desc);
create index on public.messages (session_id, created_at asc);

-- RLS
alter table public.sessions  enable row level security;
alter table public.messages  enable row level security;

create policy "users read own sessions"
  on public.sessions for select using (user_id = auth.uid());
create policy "users insert own sessions"
  on public.sessions for insert with check (user_id = auth.uid());
create policy "users update own sessions"
  on public.sessions for update using (user_id = auth.uid());

create policy "users read own messages"
  on public.messages for select using (user_id = auth.uid());
create policy "users insert own messages"
  on public.messages for insert with check (user_id = auth.uid());
```

---

## Folder Structure

```
src/
  features/
    chat/
      actions.ts              startSession, endSession, sendMessage
      components/
        ChatWindow.tsx         message list + input + streaming display
        MessageBubble.tsx
        VoiceButton.tsx        record → transcribe → sendMessage
      hooks/
        useChat.ts             Vercel AI SDK useChat wrapper
      schema.ts

  lib/
    ai/
      mem0.ts                 Mem0 Cloud client (search, add)
      elevenlabs.ts           STT (transcribe) + TTS (speak) wrappers
      chat-prompt.ts          buildChatSystemPrompt(persona, memories[])

  app/
    api/
      voice/
        transcribe/route.ts   POST audio blob → ElevenLabs STT → { text }
        speak/route.ts        POST text → ElevenLabs TTS → audio Response
      memory/
        extract/route.ts      POST sessionId → transcript → Mem0.add()
    (app)/
      chat/page.tsx
```

---

## sendMessage Server Action Pattern

```ts
'use server'
import { streamText } from 'ai'
import { createStreamableValue } from 'ai/rsc'

export async function sendMessage(sessionId: string, userText: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthenticated')

  const stream = createStreamableValue('')

  const [memories, history, session] = await Promise.all([
    mem0.search(user.id, userText),
    getRecentMessages(sessionId, 20),
    getSession(sessionId),
  ])

  let fullResponse = ''
  ;(async () => {
    const { textStream } = streamText({
      model: getModel(),
      system: buildChatSystemPrompt(session.system_prompt, memories),
      messages: [...history, { role: 'user', content: userText }],
    })
    for await (const chunk of textStream) {
      stream.update(chunk)
      fullResponse += chunk
    }
    stream.done()
    await saveMessages(sessionId, user.id, userText, fullResponse)
  })()

  return { output: stream.value }
}
```

---

## Memory Injection Format

Append to persona system_prompt when memories exist. Skip entirely when empty.

```
## CONTEXT FROM PAST SESSIONS
- User mentioned feeling overwhelmed before presentations
- User prefers short, concrete next steps over long explanations
- User has a difficult relationship with their manager at work
```

Never: "According to my memory / my records show / based on your profile."
Always: weave naturally, as the persona's own recollection.

---

## Risks and Mitigations

| Risk | Mitigation |
|---|---|
| Mem0 adds 300–600ms per turn | `Promise.all()` — search runs in parallel with message history fetch |
| ElevenLabs TTS delay before audio starts | Phase 2: Blob URL (simple, ~1-3s delay). Phase 3: swap to MediaSource streaming (~200ms) |
| Context window overflow on long sessions | Truncate to last 20 messages in `getRecentMessages()`; full history stays in DB |
| Persona prompt changes mid-session | Snapshot `system_prompt` into `sessions` row at start — immutable per session |
| Mic permission denied | Check `navigator.mediaDevices.getUserMedia` before rendering VoiceButton; degrade to text |
| Memory extraction failure | Silent fail is acceptable (best-effort enrichment); add `memory_extracted` boolean to sessions for observability |
| Mem0 user_id collision | Use Supabase UUID directly as Mem0 `user_id` — already unique and stable |
| Audio blob too large | Cap recording at 60 seconds client-side; ElevenLabs STT max is 25MB |

---

## Environment Variables Needed

Add to `.env.local`:

```
MEM0_API_KEY=...
ELEVENLABS_API_KEY=...
ELEVENLABS_VOICE_ID_P1=...   # one per persona, matches voice_id column
ELEVENLABS_VOICE_ID_P2=...
ELEVENLABS_VOICE_ID_P3=...
ELEVENLABS_VOICE_ID_P4=...
ELEVENLABS_VOICE_ID_P5=...
```

`OPENAI_API_KEY` is already set. All keys server-side only — none prefixed `NEXT_PUBLIC_`.

---

## Build Order

| Day | Work |
|---|---|
| 1 | Migration (sessions + messages + RLS), `startSession`/`endSession` server actions |
| 2 | `sendMessage` with `streamText`, `ChatWindow`/`MessageBubble`, `/chat` page — text chat end-to-end |
| 3 | `lib/ai/mem0.ts`, memory injection into system prompt, `/api/memory/extract` Route Handler |
| 4 | `lib/ai/elevenlabs.ts`, `VoiceButton`, `/api/voice/transcribe` + `/api/voice/speak`, audio playback |
| 5 | Mic fallback, context truncation, error states, `memory_extracted` visibility |
