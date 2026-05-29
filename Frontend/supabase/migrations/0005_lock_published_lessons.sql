create or replace function public.prevent_published_lesson_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and old.is_published = true then
    raise exception 'Published lessons are locked and cannot be edited or unpublished.';
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists lock_published_lessons_update on public.lessons;
create trigger lock_published_lessons_update
before update on public.lessons
for each row
execute function public.prevent_published_lesson_changes();

drop trigger if exists lock_published_lessons_delete on public.lessons;
