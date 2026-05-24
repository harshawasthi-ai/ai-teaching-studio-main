import { forwardToN8n, serviceClient } from './_webhookProxy.js'

function asStringArray(value) {
  return Array.isArray(value) ? value.map(String) : []
}

export default async function handler(req, res) {
  await forwardToN8n(req, res, {
    webhookEnvName: 'N8N_HOMEWORK_EVALUATION_WEBHOOK_URL',
    userIdFields: ['student_id'],
    afterSuccess: async ({ body, parsed, user }) => {
      if (!parsed?.success || !body.submission_id) return

      const supabase = serviceClient()
      const { data: submission, error: readError } = await supabase
        .from('lesson_submissions')
        .select('id,student_id')
        .eq('id', body.submission_id)
        .eq('student_id', user.id)
        .maybeSingle()

      if (readError || !submission) {
        throw new Error('Could not verify homework submission ownership')
      }

      const evaluatedAt = new Date().toISOString()
      const { error } = await supabase
        .from('lesson_submissions')
        .update({
          ai_homework_understanding_level: String(parsed.understanding_level || ''),
          ai_homework_understanding_score: Number(parsed.understanding_score),
          ai_homework_feedback: String(parsed.feedback || ''),
          ai_homework_strengths: asStringArray(parsed.strengths),
          ai_homework_improvements: asStringArray(parsed.improvements),
          ai_homework_teacher_note: String(parsed.teacher_note || ''),
          ai_homework_evaluated_at: evaluatedAt,
          updated_at: evaluatedAt,
        })
        .eq('id', submission.id)

      if (error) throw error
    },
  })
}
