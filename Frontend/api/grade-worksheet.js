import { forwardToN8n, serviceClient } from "./_webhookProxy.js";

function normalizeResult(parsed) {
  return Array.isArray(parsed) ? parsed[0] : parsed;
}

export default async function handler(req, res) {
  await forwardToN8n(req, res, {
    webhookEnvName: "N8N_GRADING_WEBHOOK_URL",
    userIdFields: ["student_id"],
    afterSuccess: async ({ body, parsed, user }) => {
      const result = normalizeResult(parsed);
      if (!result?.success || !body.submission_id) return;

      const supabase = serviceClient();
      const { data: submission, error: readError } = await supabase
        .from("lesson_submissions")
        .select("id,student_id")
        .eq("id", body.submission_id)
        .eq("student_id", user.id)
        .maybeSingle();

      if (readError || !submission) {
        throw new Error("Could not verify worksheet submission ownership");
      }

      const gradedAt = new Date().toISOString();
      const { error } = await supabase
        .from("lesson_submissions")
        .update({
          ai_worksheet_score: Number(result.score),
          ai_worksheet_grade: String(result.grade || ""),
          ai_worksheet_feedback: String(result.overall_feedback || ""),
          ai_worksheet_breakdown: Array.isArray(result.breakdown) ? result.breakdown : [],
          ai_worksheet_graded_at: gradedAt,
          updated_at: gradedAt,
        })
        .eq("id", submission.id);

      if (error) throw error;
    },
  });
}
