create table if not exists public.lesson_submissions (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  student_id uuid not null references auth.users(id) on delete cascade,
  teacher_id uuid not null references auth.users(id) on delete cascade,
  student_name text not null default '',
  grade text not null,
  worksheet_answers jsonb not null default '{}'::jsonb,
  quiz_answers jsonb not null default '{}'::jsonb,
  homework_answer text not null default '',
  worksheet_submitted_at timestamptz,
  homework_submitted_at timestamptz,
  score numeric,
  feedback text not null default '',
  reviewed_at timestamptz,
  worksheet_score numeric,
  worksheet_feedback text not null default '',
  worksheet_reviewed_at timestamptz,
  homework_score numeric,
  homework_feedback text not null default '',
  homework_reviewed_at timestamptz,
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (lesson_id, student_id)
);

alter table public.lesson_submissions
add column if not exists student_name text not null default '',
add column if not exists quiz_answers jsonb not null default '{}'::jsonb,
add column if not exists worksheet_submitted_at timestamptz,
add column if not exists homework_submitted_at timestamptz,
add column if not exists score numeric,
add column if not exists feedback text not null default '',
add column if not exists reviewed_at timestamptz,
add column if not exists worksheet_score numeric,
add column if not exists worksheet_feedback text not null default '',
add column if not exists worksheet_reviewed_at timestamptz,
add column if not exists homework_score numeric,
add column if not exists homework_feedback text not null default '',
add column if not exists homework_reviewed_at timestamptz;

create index if not exists lesson_submissions_teacher_idx
on public.lesson_submissions (teacher_id, submitted_at desc);

create index if not exists lesson_submissions_student_idx
on public.lesson_submissions (student_id, submitted_at desc);

alter table public.lesson_submissions enable row level security;

drop policy if exists "Students can read own submissions" on public.lesson_submissions;
drop policy if exists "Students can insert own submissions" on public.lesson_submissions;
drop policy if exists "Students can update own submissions" on public.lesson_submissions;
drop policy if exists "Teachers can read submissions for own lessons" on public.lesson_submissions;
drop policy if exists "Teachers can update reviews for own lessons" on public.lesson_submissions;

create policy "Students can read own submissions"
on public.lesson_submissions
for select
to authenticated
using (student_id = auth.uid());

create policy "Students can insert own submissions"
on public.lesson_submissions
for insert
to authenticated
with check (
  student_id = auth.uid()
  and exists (
    select 1
    from public.profiles p
    join public.lessons l on l.id = lesson_id
    where p.id = auth.uid()
      and p.role = 'student'
      and l.grade = p.grade
      and l.is_published = true
      and l.user_id = teacher_id
  )
);

create policy "Students can update own submissions"
on public.lesson_submissions
for update
to authenticated
using (student_id = auth.uid())
with check (
  student_id = auth.uid()
  and exists (
    select 1
    from public.profiles p
    join public.lessons l on l.id = lesson_id
    where p.id = auth.uid()
      and p.role = 'student'
      and l.grade = p.grade
      and l.is_published = true
      and l.user_id = teacher_id
  )
);

create policy "Teachers can read submissions for own lessons"
on public.lesson_submissions
for select
to authenticated
using (
  teacher_id = auth.uid()
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'teacher'
  )
);

create policy "Teachers can update reviews for own lessons"
on public.lesson_submissions
for update
to authenticated
using (
  teacher_id = auth.uid()
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'teacher'
  )
)
with check (
  teacher_id = auth.uid()
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'teacher'
  )
);
