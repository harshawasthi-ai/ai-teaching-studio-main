import { supabase } from "@/integrations/supabase/client";
import { appConfig } from "@/lib/config";
import { validateLessonKit, type LessonKit } from "@/lib/lessonSchema";

type LessonSection = "lesson_plan" | "worksheet" | "quiz" | "answer_key";
type RegeneratedAnswer = {
  answer: string;
  explanation?: string;
};
export type WorksheetGradingResult = {
  success: true;
  submission_id: string;
  score: number;
  total_marks: number;
  grade: string;
  overall_feedback: string;
  breakdown: Array<{
    q_number: string | number;
    student_answer: string;
    correct_answer: string;
    marks_awarded: number;
    max_marks: number;
    feedback: string;
  }>;
};
export type HomeworkEvaluationResult = {
  success: true;
  submission_id: string;
  understanding_level: string;
  understanding_score: number;
  feedback: string;
  strengths: string[];
  improvements: string[];
  teacher_note: string;
};

function parseWebhookResponse(text: string, fallbackMessage: string) {
  if (!text || !text.trim()) throw new Error("Empty response from server");
  try {
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed[0] : parsed;
  } catch {
    throw new Error(fallbackMessage);
  }
}

async function authenticatedJsonHeaders() {
  const token = (await supabase.auth.getSession()).data.session?.access_token;
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function lessonInsertPayload(d: LessonKit, userId: string) {
  return {
    subject: d.metadata.subject,
    grade: d.metadata.grade,
    topic: d.metadata.topic,
    duration: d.metadata.duration,
    language: d.metadata.language,
    objectives: d.metadata.objectives,
    lesson_plan: d.lesson_plan,
    worksheet: d.worksheet,
    quiz: d.quiz,
    answer_key: d.answer_key,
    user_id: userId,
  };
}

export async function generateLesson(formData: Record<string, any>, userId?: string) {
  const response = await fetch(appConfig.lessonWebhookUrl, {
    method: "POST",
    headers: await authenticatedJsonHeaders(),
    body: JSON.stringify({ ...formData, user_id: userId }),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(text || `Generation failed with status ${response.status}`);
  const data = parseWebhookResponse(text, "Server returned an invalid lesson response");
  if (!data.success) throw new Error(data.error || "Generation failed");

  const d = validateLessonKit(data.data, "lesson response");
  if (userId) {
    const { data: saved, error } = await supabase
      .from("lessons")
      .insert(lessonInsertPayload(d, userId))
      .select("id")
      .single();

    if (error) {
      throw new Error(`Lesson generated but could not be saved: ${error.message}`);
    }

    return { ...d, id: saved?.id, metadata: { ...d.metadata, id: saved?.id } };
  }
  return d;
}

export async function regenerateSection(metadata: any, userId?: string) {
  const response = await fetch(appConfig.lessonWebhookUrl, {
    method: "POST",
    headers: await authenticatedJsonHeaders(),
    body: JSON.stringify({ ...metadata, user_id: userId }),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(text || `Regeneration failed with status ${response.status}`);
  const data = parseWebhookResponse(text, "Server returned an invalid regeneration response");
  if (!data.success) throw new Error(data.error || "Regeneration failed");
  return validateLessonKit(data.data, "regeneration response");
}

export async function saveLessonSection(
  lessonId: string,
  userId: string,
  section: LessonSection,
  value: unknown,
) {
  const { error } = await supabase
    .from("lessons")
    .update({ [section]: value })
    .eq("id", lessonId)
    .eq("user_id", userId)
    .select("id")
    .single();

  if (error) {
    throw new Error(`Section regenerated but could not be saved: ${error.message}`);
  }
}

export async function saveLessonSections(
  lessonId: string,
  userId: string,
  values: Partial<Record<LessonSection, unknown>>,
) {
  const { error } = await supabase
    .from("lessons")
    .update(values)
    .eq("id", lessonId)
    .eq("user_id", userId)
    .select("id")
    .single();

  if (error) {
    throw new Error(`Lesson updated but could not be saved: ${error.message}`);
  }
}

export async function regenerateWorksheetAnswer(
  payload: {
    metadata: LessonKit["metadata"];
    question: unknown;
    current_answer?: unknown;
    answer_key_instruction?: string;
  },
  userId?: string,
): Promise<RegeneratedAnswer> {
  const resolvedUserId = userId ?? (await supabase.auth.getSession()).data.session?.user.id;
  const response = await fetch(appConfig.lessonWebhookUrl, {
    method: "POST",
    headers: await authenticatedJsonHeaders(),
    body: JSON.stringify({
      mode: "regenerate_worksheet_answer",
      regenerate_mode: "worksheet_answer",
      ...payload,
      user_id: resolvedUserId,
    }),
  });
  const text = await response.text();
  if (!response.ok)
    throw new Error(text || `Answer regeneration failed with status ${response.status}`);
  const data = parseWebhookResponse(
    text,
    "Server returned an invalid answer regeneration response",
  );
  if (!data.success) throw new Error(data.error || "Answer regeneration failed");

  const answerData =
    data.data?.answer_key_item || data.data?.data || data.data || data.answer_key_item || data;
  const answer =
    answerData?.answer ??
    answerData?.data?.answer ??
    answerData?.output?.answer ??
    (typeof data.data === "string" ? data.data : undefined);
  if (typeof answer !== "string" || !answer.trim()) {
    throw new Error("The regenerated response did not include an answer");
  }

  return {
    answer: answer.trim(),
    explanation:
      typeof answerData?.explanation === "string"
        ? answerData.explanation.trim()
        : typeof answerData?.data?.explanation === "string"
          ? answerData.data.explanation.trim()
          : typeof answerData?.output?.explanation === "string"
            ? answerData.output.explanation.trim()
            : undefined,
  };
}

export async function gradeWorksheetWithAi(payload: {
  lesson_id: string;
  submission_id: string;
  student_id: string;
  grade?: string;
  worksheet: unknown;
  answer_key: unknown;
  student_answers: Record<string, string>;
  total_marks: number;
}): Promise<WorksheetGradingResult> {
  const response = await fetch(appConfig.gradingWebhookUrl, {
    method: "POST",
    headers: await authenticatedJsonHeaders(),
    body: JSON.stringify(payload),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(text || `Grading failed with status ${response.status}`);
  const data = parseWebhookResponse(text, "Server returned an invalid grading response");
  if (!data.success) throw new Error(data.error || "AI grading failed");

  const score = Number(data.score);
  const totalMarks = Number(data.total_marks);
  if (!Number.isFinite(score) || !Number.isFinite(totalMarks)) {
    throw new Error("AI grading response is missing score data");
  }

  return {
    success: true,
    submission_id: String(data.submission_id || payload.submission_id),
    score,
    total_marks: totalMarks,
    grade: String(data.grade || ""),
    overall_feedback: String(data.overall_feedback || ""),
    breakdown: Array.isArray(data.breakdown) ? data.breakdown : [],
  };
}

export async function evaluateHomeworkWithAi(payload: {
  lesson_id: string;
  submission_id: string;
  student_id: string;
  metadata: LessonKit["metadata"];
  lesson_plan: LessonKit["lesson_plan"];
  homework_task: string;
  homework_answer: string;
}): Promise<HomeworkEvaluationResult> {
  const response = await fetch(appConfig.homeworkEvaluationWebhookUrl, {
    method: "POST",
    headers: await authenticatedJsonHeaders(),
    body: JSON.stringify(payload),
  });
  const text = await response.text();
  if (!response.ok)
    throw new Error(text || `Homework evaluation failed with status ${response.status}`);
  const data = parseWebhookResponse(
    text,
    "Server returned an invalid homework evaluation response",
  );
  if (!data.success) throw new Error(data.error || "AI homework evaluation failed");

  const understandingScore = Number(data.understanding_score);
  if (!Number.isFinite(understandingScore)) {
    throw new Error("AI homework evaluation response is missing understanding score");
  }

  return {
    success: true,
    submission_id: String(data.submission_id || payload.submission_id),
    understanding_level: String(data.understanding_level || ""),
    understanding_score: understandingScore,
    feedback: String(data.feedback || ""),
    strengths: Array.isArray(data.strengths) ? data.strengths.map(String) : [],
    improvements: Array.isArray(data.improvements) ? data.improvements.map(String) : [],
    teacher_note: String(data.teacher_note || ""),
  };
}
