import { z } from 'zod'

const nonEmptyString = z.string().trim().min(1)
const stringArray = z.array(z.string()).default([])

const lessonMetadataSchema = z.object({
  id: z.string().optional(),
  subject: nonEmptyString,
  grade: nonEmptyString,
  topic: nonEmptyString,
  duration: nonEmptyString,
  language: nonEmptyString,
  objectives: z.string().default(''),
  generated_at: z.string().optional(),
  question_counts: z.record(z.string(), z.unknown()).optional(),
  grade_level_guidance: z.record(z.string(), z.unknown()).optional(),
}).passthrough()

const lessonPlanSectionSchema = z.object({
  duration: z.string().optional(),
}).catchall(z.unknown())

const lessonPlanSchema = z.object({
  warm_up: lessonPlanSectionSchema,
  concept_introduction: lessonPlanSectionSchema.extend({
    key_terms: stringArray.optional(),
  }).catchall(z.unknown()),
  guided_activity: lessonPlanSectionSchema.extend({
    materials: stringArray.optional(),
  }).catchall(z.unknown()),
  recap: lessonPlanSectionSchema.extend({
    questions: stringArray.optional(),
  }).catchall(z.unknown()),
  homework: z.object({
    description: z.string().optional(),
  }).catchall(z.unknown()),
}).passthrough()

const questionSchema = z.object({
  q_number: z.union([z.number(), z.string()]).optional(),
  question: nonEmptyString,
  marks: z.coerce.number().optional(),
}).catchall(z.unknown())

const mcqSchema = questionSchema.extend({
  options: z.record(z.string(), z.string()).refine(
    (options) => ['A', 'B', 'C', 'D'].every((key) => typeof options[key] === 'string' && options[key].trim()),
    'MCQ options must include A, B, C, and D',
  ),
  correct_option: z.string().optional(),
}).catchall(z.unknown())

const worksheetSectionSchema = z.object({
  section_title: nonEmptyString,
  questions: z.array(questionSchema),
}).passthrough()

const worksheetSchema = z.object({
  instructions: z.string().default(''),
  mcq: z.array(mcqSchema),
  sections: z.array(worksheetSectionSchema).min(3),
  total_marks: z.coerce.number().optional(),
}).passthrough()

const quizSchema = z.object({
  instructions: z.string().default(''),
  mcq: z.array(mcqSchema),
  short_answer: z.array(questionSchema).default([]),
  total_marks: z.coerce.number().optional(),
}).passthrough()

const answerSchema = z.object({
  q_number: z.union([z.number(), z.string()]).optional(),
  answer: z.union([z.string(), z.number(), z.boolean()]).transform(String),
  explanation: z.string().optional(),
}).catchall(z.unknown())

const answerKeySchema = z.object({
  worksheet_answers: z.array(answerSchema),
  quiz_answers: z.array(answerSchema),
  grading_rubric: z.object({
    total_marks: z.coerce.number().optional(),
    grade_bands: z.array(z.object({
      range: z.string(),
      grade: z.string(),
      descriptor: z.string(),
    }).passthrough()).optional(),
  }).passthrough().optional(),
}).passthrough()

export const lessonKitSchema = z.object({
  metadata: lessonMetadataSchema,
  lesson_plan: lessonPlanSchema,
  worksheet: worksheetSchema,
  quiz: quizSchema,
  answer_key: answerKeySchema,
}).passthrough()

export type LessonKit = z.infer<typeof lessonKitSchema>

export function validateLessonKit(value: unknown, context = 'lesson response'): LessonKit {
  const result = lessonKitSchema.safeParse(value)
  if (result.success) return result.data

  const details = result.error.issues
    .slice(0, 5)
    .map((issue) => {
      const path = issue.path.length ? issue.path.join('.') : 'response'
      return `${path}: ${issue.message}`
    })
    .join('; ')

  throw new Error(`Invalid ${context}: ${details}`)
}
