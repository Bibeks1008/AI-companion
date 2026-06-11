-- Row Level Security. Every table has RLS enabled. User tables are strictly
-- owner-scoped via auth.uid(); personas are public read-only reference data.

alter table public.personas             enable row level security;
alter table public.profiles             enable row level security;
alter table public.onboarding_responses enable row level security;
alter table public.persona_assignments  enable row level security;

-- personas: anyone authenticated can read active personas. No client writes;
-- writes happen only via seed.sql / service role (which bypasses RLS).
create policy "Active personas are readable"
  on public.personas for select
  to authenticated
  using (is_active = true);

-- profiles: a user can read and update only their own row. Inserts happen via
-- the security-definer signup trigger, so no insert policy is exposed.
create policy "Users can read own profile"
  on public.profiles for select
  to authenticated
  using (id = (select auth.uid()));

create policy "Users can update own profile"
  on public.profiles for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- onboarding_responses: full owner-scoped access.
create policy "Users can read own onboarding responses"
  on public.onboarding_responses for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "Users can insert own onboarding responses"
  on public.onboarding_responses for insert
  to authenticated
  with check (user_id = (select auth.uid()));

create policy "Users can update own onboarding responses"
  on public.onboarding_responses for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "Users can delete own onboarding responses"
  on public.onboarding_responses for delete
  to authenticated
  using (user_id = (select auth.uid()));

-- persona_assignments: users can read and create their own assignments.
-- Assignments are immutable history, so no update/delete policies.
create policy "Users can read own persona assignments"
  on public.persona_assignments for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "Users can insert own persona assignments"
  on public.persona_assignments for insert
  to authenticated
  with check (user_id = (select auth.uid()));
