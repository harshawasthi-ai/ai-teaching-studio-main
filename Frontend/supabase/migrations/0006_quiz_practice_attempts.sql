create table if not exists public.quiz_practice_attempts (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  student_id uuid not null references auth.users(id) on delete cascade,
  answers jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  unique (lesson_id, student_id)
);

alter table public.quiz_practice_attempts enable row level security;

drop policy if exists "Students can read own quiz practice" on public.quiz_practice_attempts;
drop policy if exists "Students can insert own quiz practice" on public.quiz_practice_attempts;
drop policy if exists "Students can update own quiz practice" on public.quiz_practice_attempts;

create policy "Students can read own quiz practice"
on public.quiz_practice_attempts
for select
to authenticated
using (student_id = auth.uid());

create policy "Students can insert own quiz practice"
on public.quiz_practice_attempts
for insert
to authenticated
with check (student_id = auth.uid());

create policy "Students can update own quiz practice"
on public.quiz_practice_attempts
for update
to authenticated
using (student_id = auth.uid())
with check (student_id = auth.uid());
