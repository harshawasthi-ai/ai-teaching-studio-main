create extension if not exists pgcrypto;

create table if not exists public.lessons (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subject text not null,
  grade text not null,
  topic text not null,
  duration text not null,
  language text not null default 'English',
  objectives text not null default '',
  lesson_plan jsonb not null,
  worksheet jsonb not null,
  quiz jsonb not null,
  answer_key jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists lessons_user_created_at_idx
on public.lessons (user_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists lessons_set_updated_at on public.lessons;
create trigger lessons_set_updated_at
before update on public.lessons
for each row
execute function public.set_updated_at();

alter table public.lessons enable row level security;

drop policy if exists "Users manage own lessons" on public.lessons;
drop policy if exists "Users can read own lessons" on public.lessons;
drop policy if exists "Users can insert own lessons" on public.lessons;
drop policy if exists "Users can update own lessons" on public.lessons;
drop policy if exists "Users can delete own lessons" on public.lessons;

create policy "Users can read own lessons"
on public.lessons
for select
to authenticated
using (user_id = auth.uid());

create policy "Users can insert own lessons"
on public.lessons
for insert
to authenticated
with check (user_id = auth.uid());

create policy "Users can update own lessons"
on public.lessons
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "Users can delete own lessons"
on public.lessons
for delete
to authenticated
using (user_id = auth.uid());
