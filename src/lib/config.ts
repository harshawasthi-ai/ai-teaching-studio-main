function requiredEnv(name: keyof ImportMetaEnv) {
  const value = import.meta.env[name];
  if (typeof value === "string" && value.trim()) return value.trim();
  throw new Error(`Missing ${name}. Add it to your Vite environment before starting the app.`);
}

function optionalEnv(name: keyof ImportMetaEnv, fallback: string) {
  const value = import.meta.env[name];
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

export const appConfig = {
  supabaseUrl: requiredEnv("VITE_SUPABASE_URL"),
  supabaseAnonKey: requiredEnv("VITE_SUPABASE_ANON_KEY"),
  lessonWebhookUrl: optionalEnv("VITE_LESSON_WEBHOOK_URL", "/api/lesson-webhook"),
  gradingWebhookUrl: optionalEnv("VITE_GRADING_WEBHOOK_URL", "/api/grade-worksheet"),
  homeworkEvaluationWebhookUrl: optionalEnv(
    "VITE_HOMEWORK_EVALUATION_WEBHOOK_URL",
    "/api/evaluate-homework",
  ),
};
