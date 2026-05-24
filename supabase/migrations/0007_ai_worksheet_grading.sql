alter table public.lesson_submissions
add column if not exists ai_worksheet_score numeric,
add column if not exists ai_worksheet_grade text,
add column if not exists ai_worksheet_feedback text not null default '',
add column if not exists ai_worksheet_breakdown jsonb not null default '[]'::jsonb,
add column if not exists ai_worksheet_graded_at timestamptz;
