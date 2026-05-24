alter table public.lessons
add column if not exists is_published boolean not null default false,
add column if not exists published_at timestamptz;

create index if not exists lessons_published_grade_idx
on public.lessons (is_published, grade, published_at desc);

drop policy if exists "Students can read published lessons for own grade" on public.lessons;

create policy "Students can read published lessons for own grade"
on public.lessons
for select
to authenticated
using (
  is_published = true
  and grade = (
    select p.grade
    from public.profiles p
    where p.id = auth.uid()
    and p.role = 'student'
  )
);
