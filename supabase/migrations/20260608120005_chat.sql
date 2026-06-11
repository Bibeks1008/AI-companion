-- AI Companion — Phase 2 chat schema
-- Tables: sessions (one per conversation), messages (one per turn).
-- Both tables attach to existing Phase 1 parents (profiles, personas)
-- without any redesign. See docs/chat-architecture.md.

-- ---------------------------------------------------------------------------
-- sessions: one row per conversation. Snapshots system_prompt and voice_id at
-- session start so old sessions replay correctly even if the persona changes.
-- voice_id is nullable because personas.voice_id is nullable (voice is Phase 3).
-- memory_extracted tracks post-session Mem0 extraction (Phase 2B).
-- ---------------------------------------------------------------------------
create table public.sessions (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.profiles (id) on delete cascade,
  persona_id       text not null references public.personas (id),
  system_prompt    text not null,    -- snapshot at session start
  voice_id         text,             -- snapshot at session start; null = text-only session
  started_at       timestamptz not null default now(),
  ended_at         timestamptz,      -- null = session still active
  memory_extracted boolean not null default false,
  created_at       timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- messages: one row per turn. role is 'user' | 'assistant'.
-- created_at asc gives chronological message order within a session.
-- ---------------------------------------------------------------------------
create table public.messages (
  id         uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  role       text not null check (role in ('user', 'assistant')),
  content    text not null,
  created_at timestamptz not null default now()
);

create index sessions_user_started_idx  on public.sessions (user_id, started_at desc);
create index sessions_user_active_idx   on public.sessions (user_id, ended_at) where ended_at is null;
create index messages_session_order_idx on public.messages (session_id, created_at asc);

-- ---------------------------------------------------------------------------
-- RLS — owner-scoped on both tables. Same pattern as Phase 1 tables.
-- (select auth.uid()) is evaluated once per statement, not per row.
-- ---------------------------------------------------------------------------
alter table public.sessions enable row level security;
alter table public.messages  enable row level security;

-- sessions
create policy "Users can read own sessions"
  on public.sessions for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "Users can insert own sessions"
  on public.sessions for insert
  to authenticated
  with check (user_id = (select auth.uid()));

create policy "Users can update own sessions"
  on public.sessions for update
  to authenticated
  using  (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- messages
create policy "Users can read own messages"
  on public.messages for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "Users can insert own messages"
  on public.messages for insert
  to authenticated
  with check (user_id = (select auth.uid()));
