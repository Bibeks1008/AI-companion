-- Reusable auto-updated_at trigger. One shared function, attached to every
-- table that carries an updated_at column. Keeps updated_at correct regardless
-- of which client performs the write (never set in application code).

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger set_updated_at
  before update on public.personas
  for each row execute function public.set_updated_at();

-- Future tables with updated_at (e.g. memory) should attach this same trigger.
