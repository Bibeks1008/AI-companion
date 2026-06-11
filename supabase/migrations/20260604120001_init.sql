-- AI Companion — Phase 1 core schema
-- Tables: personas (reference data), profiles (1:1 auth.users),
--         onboarding_responses (raw answers), persona_assignments (audit log).
-- Designed so Phase 2 (sessions, messages, memory) attaches to these parents
-- without redesign. See docs/database-design.md.

-- ---------------------------------------------------------------------------
-- personas: the 5 companion archetypes. Prompt text lives in a column so it
-- can be iterated via seed.sql re-runs without a schema migration.
-- ---------------------------------------------------------------------------
create table public.personas (
  id            text primary key,                       -- 'P1'..'P5'
  name          text not null,
  archetype     text not null,
  description   text not null,
  system_prompt text not null,
  best_for      text not null default '',
  traits        text[] not null default '{}',
  voice_id      text,                                   -- nullable; voice is Phase 3
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- profiles: app-level user row, keyed 1:1 to auth.users. Auto-created on
-- signup by the handle_new_user trigger (see profile_trigger migration).
-- ---------------------------------------------------------------------------
create table public.profiles (
  id                      uuid primary key references auth.users (id) on delete cascade,
  email                   text,
  onboarding_completed    boolean not null default false,
  onboarding_completed_at timestamptz,                  -- set when onboarding succeeds + persona assigned
  active_persona_id       text references public.personas (id),
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- onboarding_responses: one row per (user, question). answer is JSONB so a
-- single column covers choice / scale / free-text answers uniformly.
-- ---------------------------------------------------------------------------
create table public.onboarding_responses (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles (id) on delete cascade,
  question_key text not null,
  answer       jsonb not null,
  created_at   timestamptz not null default now(),
  unique (user_id, question_key)
);

-- ---------------------------------------------------------------------------
-- persona_assignments: audit log of every assignment. Source of truth for
-- "what persona, and why". emotions is JSONB: [{ "name": ..., "score": ... }].
-- ---------------------------------------------------------------------------
create table public.persona_assignments (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.profiles (id) on delete cascade,
  persona_id     text not null references public.personas (id),
  confidence     int not null check (confidence between 0 and 100),
  emotions       jsonb not null default '[]',
  reasoning      text not null default '',              -- AI's short user-facing "why"
  user_initiated boolean not null default false,        -- false = system-assigned at onboarding
  created_at     timestamptz not null default now()
);

create index onboarding_responses_user_id_idx on public.onboarding_responses (user_id);
create index persona_assignments_user_created_idx on public.persona_assignments (user_id, created_at desc);
create index profiles_active_persona_id_idx on public.profiles (active_persona_id);
