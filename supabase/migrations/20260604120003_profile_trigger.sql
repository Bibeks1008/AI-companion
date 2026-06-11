-- Auto-provision a public.profiles row whenever a new auth.users row is created.
-- security definer so the trigger can insert into public.profiles regardless of
-- the calling role; search_path is pinned to '' per Supabase hardening guidance.

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
