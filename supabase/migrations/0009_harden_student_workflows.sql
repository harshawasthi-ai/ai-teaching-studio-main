create or replace function public.current_profile_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role
  from public.profiles
  where id = auth.uid()
$$;

grant execute on function public.current_profile_role() to authenticated;

drop policy if exists "Teachers can read student profile summaries" on public.profiles;
create policy "Teachers can read student profile summaries"
on public.profiles
for select
to authenticated
using (
  role = 'student'
  and public.current_profile_role() = 'teacher'
);

create or replace function public.prevent_student_submission_rewrites()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_role text;
begin
  select role into actor_role
  from public.profiles
  where id = auth.uid();

  if actor_role = 'student' and old.student_id = auth.uid() then
    if new.id is distinct from old.id
      or new.lesson_id is distinct from old.lesson_id
      or new.student_id is distinct from old.student_id
      or new.teacher_id is distinct from old.teacher_id
      or new.grade is distinct from old.grade then
      raise exception 'Students cannot change submission ownership fields';
    end if;

    if old.worksheet_submitted_at is not null and (
      new.worksheet_answers is distinct from old.worksheet_answers
      or new.worksheet_submitted_at is distinct from old.worksheet_submitted_at
    ) then
      raise exception 'Worksheet answers cannot be edited after submission';
    end if;

    if old.homework_submitted_at is not null and (
      new.homework_answer is distinct from old.homework_answer
      or new.homework_submitted_at is distinct from old.homework_submitted_at
    ) then
      raise exception 'Homework cannot be edited after submission';
    end if;

    if new.score is distinct from old.score
      or new.feedback is distinct from old.feedback
      or new.reviewed_at is distinct from old.reviewed_at
      or new.worksheet_score is distinct from old.worksheet_score
      or new.worksheet_feedback is distinct from old.worksheet_feedback
      or new.worksheet_reviewed_at is distinct from old.worksheet_reviewed_at
      or new.homework_score is distinct from old.homework_score
      or new.homework_feedback is distinct from old.homework_feedback
      or new.homework_reviewed_at is distinct from old.homework_reviewed_at then
      raise exception 'Students cannot change teacher review fields';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_student_submission_rewrites on public.lesson_submissions;
create trigger prevent_student_submission_rewrites
before update on public.lesson_submissions
for each row
execute function public.prevent_student_submission_rewrites();

drop policy if exists "Students can insert own quiz practice" on public.quiz_practice_attempts;
drop policy if exists "Students can update own quiz practice" on public.quiz_practice_attempts;

create policy "Students can insert own quiz practice"
on public.quiz_practice_attempts
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
  )
);

create policy "Students can update own quiz practice"
on public.quiz_practice_attempts
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
  )
);
