interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  readonly VITE_LESSON_WEBHOOK_URL: string
  readonly VITE_GRADING_WEBHOOK_URL: string
  readonly VITE_HOMEWORK_EVALUATION_WEBHOOK_URL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare module '*?url' {
  const url: string
  export default url
}
