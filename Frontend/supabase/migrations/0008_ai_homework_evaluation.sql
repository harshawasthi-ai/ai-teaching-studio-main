alter table public.lesson_submissions
add column if not exists ai_homework_understanding_level text,
add column if not exists ai_homework_understanding_score numeric,
add column if not exists ai_homework_feedback text not null default '',
add column if not exists ai_homework_strengths jsonb not null default '[]'::jsonb,
add column if not exists ai_homework_improvements jsonb not null default '[]'::jsonb,
add column if not exists ai_homework_teacher_note text not null default '',
add column if not exists ai_homework_evaluated_at timestamptz;
