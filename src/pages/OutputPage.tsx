import { Component, useEffect, useState, type ReactNode } from 'react'
import { useNavigate, useParams } from '@tanstack/react-router'
import { toast } from 'sonner'
import { Download, Plus, RefreshCw, Loader2, Key, Edit3, Save, X, ChevronDown, AlertTriangle, ArrowLeft } from 'lucide-react'
import { Header, FloatingBlobs } from '@/components/app/Layout'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/integrations/supabase/client'
import { evaluateHomeworkWithAi, gradeWorksheetWithAi, regenerateSection, regenerateWorksheetAnswer, saveLessonSection, saveLessonSections } from '@/lib/generateLesson'
import { buildAnswerKeyInstruction, getGradeLevelGuidance } from '@/lib/gradeGuidance'
import type { LessonKit } from '@/lib/lessonSchema'

type TabKey = 'lesson_plan' | 'homework' | 'worksheet' | 'quiz' | 'answer_key'
type ExportMode = 'full' | TabKey
type LessonWithId = LessonKit & { id?: string; metadata: LessonKit['metadata'] & { id?: string; teacher_id?: string; is_published?: boolean; published_at?: string | null } }
type LessonPlan = LessonKit['lesson_plan']
type Worksheet = LessonKit['worksheet']
type Quiz = LessonKit['quiz']
type AnswerKey = LessonKit['answer_key']
type EditableValue = Record<string, unknown>
type EditableChange = (data: EditableValue) => void
type LessonPlanSectionData = Record<string, unknown> & {
  duration?: string
  activity?: string
  content?: string
  description?: string
  key_terms?: string[]
  materials?: string[]
  questions?: string[]
  purpose?: string
}
type LessonPlanSectionKey = 'warm_up' | 'concept_introduction' | 'guided_activity' | 'recap'
type QuestionData = Record<string, unknown> & {
  q_number?: string | number
  question?: string
  text?: string
  marks?: string | number
  options?: Record<string, string>
  isMcq?: boolean
  originalNumber?: string | number
  displayNumber?: string | number
  source?: string
}
type WorksheetSectionData = Record<string, unknown> & {
  section_title?: string
  title?: string
  questions?: Array<QuestionData | string>
}
type AnswerData = Record<string, unknown> & {
  q_number?: string | number
  answer?: string | number | boolean
  explanation?: string
  displayNumber?: string | number
}
type RubricBand = Record<string, unknown> & {
  range?: string
  grade?: string
  descriptor?: string
}
type WorksheetQuestionGroup = {
  key: 'worksheet_mcq' | 'one_sentence' | 'short' | 'long'
  label: string
  description: string
  match: (question: QuestionData) => boolean
  questions: QuestionData[]
}
type StudentWorksheetAnswers = Record<string, string>
type StudentQuizAnswers = Record<string, string>
type StudentReview = {
  score: number | null
  feedback: string
  reviewed_at: string | null
}
type AiWorksheetReview = {
  score: number | null
  grade: string
  feedback: string
  breakdown: Array<Record<string, unknown>>
  graded_at: string | null
}
type AiHomeworkReview = {
  understanding_level: string
  understanding_score: number | null
  feedback: string
  strengths: string[]
  improvements: string[]
  teacher_note: string
  evaluated_at: string | null
}
type StudentReviews = {
  worksheet: StudentReview | null
  homework: StudentReview | null
}

const TABS: { k: TabKey; label: string; icon: string }[] = [
  { k: 'lesson_plan', label: 'Lesson Plan', icon: '📋' },
  { k: 'homework', label: 'Homework', icon: '🏠' },
  { k: 'quiz', label: 'Quiz', icon: '❓' },
  { k: 'worksheet', label: 'Worksheet', icon: '📝' },
  { k: 'answer_key', label: 'Answer Key', icon: '✅' },
]

const EXPORT_OPTIONS: { key: ExportMode; label: string }[] = [
  { key: 'full', label: 'Full Lesson Kit' },
  { key: 'lesson_plan', label: 'Lesson Plan Only' },
  { key: 'homework', label: 'Homework Only' },
  { key: 'quiz', label: 'Quiz Only' },
  { key: 'worksheet', label: 'Worksheet Only' },
  { key: 'answer_key', label: 'Answer Key Only' },
]

const STUDENT_EXPORT_OPTIONS = EXPORT_OPTIONS.filter(option => option.key !== 'answer_key')

class OutputErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false }
  static getDerivedStateFromError() { return { hasError: true } }
  componentDidCatch(error: unknown) {
    console.error('OutputPage rendering error:', error)
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen text-white px-6 text-center">
          <h1 className="text-2xl font-bold mb-3">Something went wrong</h1>
          <p className="text-white/70 mb-8">
            An unexpected error occurred while loading the page.
          </p>
          <button
            onClick={() => { window.location.href = '/' }}
            className="px-6 py-3 rounded-xl text-white font-semibold"
            style={{
              background: 'linear-gradient(135deg,#1E6FD9,#4DA3FF)',
              boxShadow: '0 8px 20px rgba(30,111,217,0.4)'
            }}
          >
            Go Home
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

function readStoredLesson(): LessonWithId | null {
  const stored = sessionStorage.getItem('currentLesson')
  if (!stored) return null
  try {
    return JSON.parse(stored) as LessonWithId
  } catch {
    return null
  }
}

function getStudentQuizStorageKey(userId?: string, lessonId?: string) {
  if (!userId || !lessonId) return null
  return `student-quiz-answers:${userId}:${lessonId}`
}

function readStudentQuizAnswers(userId?: string, lessonId?: string): StudentQuizAnswers {
  const key = getStudentQuizStorageKey(userId, lessonId)
  if (!key || typeof window === 'undefined') return {}
  try {
    return JSON.parse(window.localStorage.getItem(key) || '{}') as StudentQuizAnswers
  } catch {
    return {}
  }
}

function writeStudentQuizAnswers(userId: string | undefined, lessonId: string | undefined, answers: StudentQuizAnswers) {
  const key = getStudentQuizStorageKey(userId, lessonId)
  if (!key || typeof window === 'undefined') return
  window.localStorage.setItem(key, JSON.stringify(answers))
}

async function saveQuizPracticeAnswers({
  userId,
  lessonId,
  answers,
}: {
  userId: string
  lessonId: string
  answers: StudentQuizAnswers
}) {
  const { error } = await supabase
    .from('quiz_practice_attempts')
    .upsert({
      lesson_id: lessonId,
      student_id: userId,
      answers,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'lesson_id,student_id' })

  if (error) throw error
}

function getErrorMessage(error: unknown, fallback = 'Something went wrong') {
  return error instanceof Error ? error.message : fallback
}

function lessonRowToLesson(data: {
  id: string
  subject: string
  grade: string
  topic: string
  duration: string
  language: string
  objectives?: string
  created_at?: string
  user_id?: string
  is_published?: boolean
  published_at?: string | null
  lesson_plan: LessonPlan
  worksheet: Worksheet
  quiz: Quiz
  answer_key?: AnswerKey
}): LessonWithId {
  return {
    id: data.id,
    metadata: {
      id: data.id,
      subject: data.subject,
      grade: data.grade,
      topic: data.topic,
      duration: data.duration,
      language: data.language,
      objectives: data.objectives ?? '',
      generated_at: data.created_at,
      teacher_id: data.user_id,
      is_published: data.is_published,
      published_at: data.published_at,
    },
    lesson_plan: data.lesson_plan,
    worksheet: data.worksheet,
    quiz: data.quiz,
    answer_key: data.answer_key ?? { worksheet_answers: [], quiz_answers: [] },
  }
}

function LessonLoadState({
  state,
  message,
  onRetry,
  onLibrary,
  onCreate,
}: {
  state: 'loading' | 'error'
  message?: string
  onRetry?: () => void
  onLibrary?: () => void
  onCreate?: () => void
}) {
  return (
    <div className="min-h-screen relative">
      <FloatingBlobs />
      <Header />
      <main className="relative min-h-[70vh] flex items-center justify-center px-4">
        <div className="w-full max-w-md rounded-3xl border border-white/10 backdrop-blur-xl p-8 text-center" style={{ background: 'rgba(255,255,255,0.06)' }}>
          {state === 'loading' ? (
            <>
              <Loader2 className="w-8 h-8 animate-spin text-blue-300 mx-auto mb-4" />
              <h1 className="text-white text-xl font-bold">Loading lesson</h1>
              <p className="text-blue-200 text-sm mt-2">Opening your saved lesson kit...</p>
            </>
          ) : (
            <>
              <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-red-500/15 text-red-300 border border-red-400/25">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h1 className="text-white text-xl font-bold">Lesson not available</h1>
              <p className="text-blue-200 text-sm mt-2">{message}</p>
              <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
                {onRetry && (
                  <button
                    type="button"
                    onClick={onRetry}
                    className="px-5 py-3 rounded-xl text-white font-semibold border border-blue-300/25 hover:bg-blue-400/10 transition"
                  >
                    Retry
                  </button>
                )}
                <button
                  type="button"
                  onClick={onLibrary}
                  className="px-5 py-3 rounded-xl text-white font-semibold border border-white/15 hover:bg-white/10 transition"
                >
                  Go to Library
                </button>
                <button
                  type="button"
                  onClick={onCreate}
                  className="px-5 py-3 rounded-xl text-white font-semibold"
                  style={{ background: 'linear-gradient(135deg,#1E6FD9,#4DA3FF)', boxShadow: '0 8px 20px rgba(30,111,217,0.35)' }}
                >
                  Create Lesson
                </button>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  )
}

export default function OutputPage() {
  return (
    <OutputErrorBoundary>
      <OutputPageInner />
    </OutputErrorBoundary>
  )
}

function OutputPageInner() {
  const navigate = useNavigate()
  const { lessonId } = useParams({ strict: false })
  const { user, profile } = useAuth()
  const [lesson, setLesson] = useState<LessonWithId | null>(null)
  const [loadingLesson, setLoadingLesson] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loadAttempt, setLoadAttempt] = useState(0)
  const [tab, setTab] = useState<TabKey>('lesson_plan')
  const [regen, setRegen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<EditableValue | null>(null)
  const [saving, setSaving] = useState(false)
  const [exportMode, setExportMode] = useState<ExportMode>('full')
  const [exportMenuOpen, setExportMenuOpen] = useState(false)
  const [regeneratingQuestion, setRegeneratingQuestion] = useState<string | null>(null)
  const [regeneratingAnswer, setRegeneratingAnswer] = useState<string | null>(null)
  const [studentWorksheetAnswers, setStudentWorksheetAnswers] = useState<StudentWorksheetAnswers>({})
  const [studentQuizAnswers, setStudentQuizAnswers] = useState<StudentQuizAnswers>({})
  const [studentHomeworkAnswer, setStudentHomeworkAnswer] = useState('')
  const [worksheetSubmittedAt, setWorksheetSubmittedAt] = useState<string | null>(null)
  const [homeworkSubmittedAt, setHomeworkSubmittedAt] = useState<string | null>(null)
  const [studentReviews, setStudentReviews] = useState<StudentReviews>({ worksheet: null, homework: null })
  const [aiWorksheetReview, setAiWorksheetReview] = useState<AiWorksheetReview | null>(null)
  const [aiHomeworkReview, setAiHomeworkReview] = useState<AiHomeworkReview | null>(null)
  const [savingStudentWork, setSavingStudentWork] = useState(false)
  const isTeacher = profile?.role !== 'student'
  const visibleTabs = isTeacher ? TABS : TABS.filter(item => item.k !== 'answer_key')

  useEffect(() => {
    let cancelled = false

    const loadLesson = async () => {
      setLoadingLesson(true)
      setLoadError(null)

      if (lessonId && user?.id) {
        const stored = readStoredLesson()
        if (isTeacher && stored && (stored.id === lessonId || stored.metadata?.id === lessonId)) {
          setLesson(stored)
        }

        const { data, error } = isTeacher
          ? await supabase
              .from('lessons')
              .select('id,subject,grade,topic,duration,language,objectives,created_at,is_published,published_at,lesson_plan,worksheet,quiz,answer_key')
              .eq('id', lessonId)
              .eq('user_id', user.id)
              .single()
          : await supabase
              .from('lessons')
              .select('id,user_id,subject,grade,topic,duration,language,objectives,created_at,is_published,published_at,lesson_plan,worksheet,quiz,answer_key')
              .eq('id', lessonId)
              .eq('is_published', true)
              .eq('grade', profile?.grade || '')
              .single()

        if (cancelled) return

        if (error || !data) {
          setLoadError('We could not find this lesson. It may have been deleted, or you may not have access to it.')
          setLoadingLesson(false)
          return
        }

        const next = lessonRowToLesson(data)
        setLesson(next)
        if (isTeacher) sessionStorage.setItem('currentLesson', JSON.stringify(next))
        if (!isTeacher) {
          const currentLessonId = next.id ?? next.metadata.id ?? lessonId
          const { data: submission } = await supabase
            .from('lesson_submissions')
            .select('worksheet_answers,quiz_answers,homework_answer,worksheet_submitted_at,homework_submitted_at,worksheet_score,worksheet_feedback,worksheet_reviewed_at,homework_score,homework_feedback,homework_reviewed_at,ai_worksheet_score,ai_worksheet_grade,ai_worksheet_feedback,ai_worksheet_breakdown,ai_worksheet_graded_at,ai_homework_understanding_level,ai_homework_understanding_score,ai_homework_feedback,ai_homework_strengths,ai_homework_improvements,ai_homework_teacher_note,ai_homework_evaluated_at,score,feedback,reviewed_at,submitted_at')
            .eq('lesson_id', lessonId)
            .eq('student_id', user.id)
            .maybeSingle()
          const { data: quizPractice } = await supabase
            .from('quiz_practice_attempts')
            .select('answers')
            .eq('lesson_id', currentLessonId)
            .eq('student_id', user.id)
            .maybeSingle()

          if (!cancelled) {
            const savedQuizAnswers = (quizPractice?.answers as StudentQuizAnswers | null) ?? {}
            const legacyQuizAnswers = (submission?.quiz_answers as StudentQuizAnswers | null) ?? {}
            const storedQuizAnswers = readStudentQuizAnswers(user.id, currentLessonId)
            const nextQuizAnswers = Object.keys(savedQuizAnswers).length > 0
              ? savedQuizAnswers
              : Object.keys(legacyQuizAnswers).length > 0
                ? legacyQuizAnswers
                : storedQuizAnswers
            setStudentWorksheetAnswers((submission?.worksheet_answers as StudentWorksheetAnswers | null) ?? {})
            setStudentQuizAnswers(nextQuizAnswers)
            if (Object.keys(savedQuizAnswers).length === 0 && Object.keys(nextQuizAnswers).length > 0) {
              void saveQuizPracticeAnswers({
                userId: user.id,
                lessonId: currentLessonId,
                answers: nextQuizAnswers,
              }).catch(() => undefined)
            }
            setStudentHomeworkAnswer(submission?.homework_answer ?? '')
            const hasWorksheetAnswers = Object.values((submission?.worksheet_answers as StudentWorksheetAnswers | null) ?? {}).some(Boolean)
            setWorksheetSubmittedAt(submission?.worksheet_submitted_at ?? (hasWorksheetAnswers ? submission?.submitted_at ?? null : null))
            setHomeworkSubmittedAt(submission?.homework_submitted_at ?? (submission?.homework_answer ? submission?.submitted_at ?? null : null))
            setAiWorksheetReview(submission?.ai_worksheet_graded_at ? {
              score: typeof submission.ai_worksheet_score === 'number' ? submission.ai_worksheet_score : null,
              grade: submission.ai_worksheet_grade || '',
              feedback: submission.ai_worksheet_feedback || '',
              breakdown: Array.isArray(submission.ai_worksheet_breakdown) ? submission.ai_worksheet_breakdown as Array<Record<string, unknown>> : [],
              graded_at: submission.ai_worksheet_graded_at,
            } : null)
            setAiHomeworkReview(submission?.ai_homework_evaluated_at ? {
              understanding_level: submission.ai_homework_understanding_level || '',
              understanding_score: typeof submission.ai_homework_understanding_score === 'number' ? submission.ai_homework_understanding_score : null,
              feedback: submission.ai_homework_feedback || '',
              strengths: Array.isArray(submission.ai_homework_strengths) ? submission.ai_homework_strengths.map(String) : [],
              improvements: Array.isArray(submission.ai_homework_improvements) ? submission.ai_homework_improvements.map(String) : [],
              teacher_note: submission.ai_homework_teacher_note || '',
              evaluated_at: submission.ai_homework_evaluated_at,
            } : null)
            setStudentReviews({
              worksheet: submission?.worksheet_reviewed_at || submission?.reviewed_at ? {
                score: typeof submission.worksheet_score === 'number' ? submission.worksheet_score : (typeof submission.score === 'number' ? submission.score : null),
                feedback: submission.worksheet_feedback || submission.feedback || '',
                reviewed_at: submission.worksheet_reviewed_at || submission.reviewed_at || null,
              } : null,
              homework: submission?.homework_reviewed_at ? {
                score: typeof submission.homework_score === 'number' ? submission.homework_score : null,
                feedback: submission.homework_feedback || '',
                reviewed_at: submission.homework_reviewed_at,
              } : null,
            })
          }
        }
        setLoadingLesson(false)
        return
      }

      const stored = readStoredLesson()
      if (!stored) {
        setLoadError('No lesson is currently open. Create a new lesson or choose one from your library.')
        setLoadingLesson(false)
        return
      }

      setLesson(stored)
      setLoadingLesson(false)
    }

    loadLesson()
    return () => { cancelled = true }
  }, [lessonId, navigate, user?.id, profile?.grade, isTeacher, loadAttempt])

  useEffect(() => {
    if (!isTeacher && tab === 'answer_key') {
      setTab('lesson_plan')
    }
  }, [isTeacher, tab])

  if (loadingLesson) {
    return <LessonLoadState state="loading" />
  }

  if (loadError || !lesson) {
    return (
      <LessonLoadState
        state="error"
        message={loadError || 'This lesson could not be loaded.'}
        onRetry={() => setLoadAttempt(value => value + 1)}
        onLibrary={() => navigate({ to: '/library' })}
        onCreate={() => navigate({ to: '/' })}
      />
    )
  }

  const startEdit = () => {
    if (lesson.metadata?.is_published) {
      toast.message('This lesson is published and locked.')
      return
    }
    setDraft(cloneValue(tab === 'homework' ? lesson.lesson_plan?.homework : lesson[tab]))
    setEditing(true)
  }

  const cancelEdit = () => {
    setDraft(null)
    setEditing(false)
  }

  const saveEdit = async () => {
    if (lesson.metadata?.is_published) {
      toast.message('This lesson is published and locked.')
      setEditing(false)
      setDraft(null)
      return
    }
    if (!draft) return
    setSaving(true)
    try {
      const lessonId = lesson.id ?? lesson.metadata?.id
      const sectionKey: 'lesson_plan' | 'worksheet' | 'quiz' | 'answer_key' =
        tab === 'homework' ? 'lesson_plan' : tab
      const sectionValue = tab === 'homework'
        ? { ...(lesson.lesson_plan || {}), homework: draft }
        : draft

      if (lessonId && user?.id) {
        await saveLessonSection(lessonId, user.id, sectionKey, sectionValue)
      }

      const next = (tab === 'homework'
        ? { ...lesson, id: lessonId, lesson_plan: sectionValue, metadata: { ...lesson.metadata, id: lessonId } }
        : { ...lesson, id: lessonId, [tab]: draft, metadata: { ...lesson.metadata, id: lessonId } }) as LessonWithId
      setLesson(next)
      sessionStorage.setItem('currentLesson', JSON.stringify(next))
      setEditing(false)
      setDraft(null)
      toast.success(lessonId ? '✅ Changes saved!' : '✅ Changes saved for this session!')
    } catch (e: unknown) {
      toast.error(`❌ ${getErrorMessage(e)}`)
    } finally {
      setSaving(false)
    }
  }

  const handleRegenerate = async () => {
    if (lesson.metadata?.is_published) {
      toast.message('This lesson is published and locked.')
      return
    }
    if (editing) cancelEdit()
    setRegen(true)
    try {
      const fresh = await regenerateSection({
        ...lesson.metadata,
        grade_level_guidance: getGradeLevelGuidance(lesson.metadata?.grade || ''),
      }, user?.id)
      const freshSection = tab === 'homework' ? fresh.lesson_plan?.homework : fresh[tab]
      if (!freshSection) throw new Error('The regenerated response did not include this section')

      const lessonId = lesson.id ?? lesson.metadata?.id
      const sectionKey: 'lesson_plan' | 'worksheet' | 'quiz' | 'answer_key' =
        tab === 'homework' ? 'lesson_plan' : tab
      const sectionValue = tab === 'homework'
        ? { ...(lesson.lesson_plan || {}), homework: freshSection }
        : freshSection

      if (lessonId && user?.id) {
        if ((tab === 'worksheet' || tab === 'quiz') && fresh.answer_key) {
          await saveLessonSections(lessonId, user.id, {
            [sectionKey]: sectionValue,
            answer_key: fresh.answer_key,
          })
        } else {
          await saveLessonSection(lessonId, user.id, sectionKey, sectionValue)
        }
      }

      const next = (tab === 'homework'
        ? { ...lesson, id: lessonId, lesson_plan: sectionValue, metadata: { ...lesson.metadata, id: lessonId } }
        : {
            ...lesson,
            id: lessonId,
            [tab]: freshSection,
            ...((tab === 'worksheet' || tab === 'quiz') && fresh.answer_key ? { answer_key: fresh.answer_key } : {}),
            metadata: { ...lesson.metadata, id: lessonId },
          }) as LessonWithId
      setLesson(next)
      sessionStorage.setItem('currentLesson', JSON.stringify(next))
      toast.success(lessonId ? '✅ Section regenerated and saved!' : '✅ Section regenerated!')
    } catch (e: unknown) {
      toast.error(`❌ ${getErrorMessage(e)}`)
    } finally { setRegen(false) }
  }

  const handleRegenerateWorksheetQuestion = async (
    groupKey: WorksheetQuestionGroup['key'],
    question: QuestionData,
    questionIndex: number,
  ) => {
    if (lesson.metadata?.is_published) {
      toast.message('This lesson is published and locked.')
      return
    }
    const token = `${groupKey}-${question.displayNumber ?? question.q_number ?? questionIndex}`
    setRegeneratingQuestion(token)
    try {
      const fresh = await regenerateSection({
        ...lesson.metadata,
        grade_level_guidance: getGradeLevelGuidance(lesson.metadata?.grade || ''),
      }, user?.id)

      const freshGroup = collectWorksheetQuestions(fresh.worksheet).find(group => group.key === groupKey)
      const freshQuestion = freshGroup?.questions[questionIndex]
      if (!freshQuestion) throw new Error('The regenerated response did not include a replacement question')

      const freshAnswer = findAnswerForQuestion(freshQuestion, fresh.answer_key?.worksheet_answers || [])
      if (!freshAnswer) throw new Error('The regenerated response did not include an answer for the replacement question')

      const nextWorksheet = replaceWorksheetQuestion(lesson.worksheet, groupKey, questionIndex, question, freshQuestion)
      const nextAnswerKey = replaceWorksheetAnswer(lesson.answer_key, question, freshAnswer)
      const lessonId = lesson.id ?? lesson.metadata?.id

      if (lessonId && user?.id) {
        await saveLessonSections(lessonId, user.id, {
          worksheet: nextWorksheet,
          answer_key: nextAnswerKey,
        })
      }

      const next = {
        ...lesson,
        id: lessonId,
        worksheet: nextWorksheet,
        answer_key: nextAnswerKey,
        metadata: { ...lesson.metadata, id: lessonId },
      }
      setLesson(next)
      sessionStorage.setItem('currentLesson', JSON.stringify(next))
      toast.success(lessonId ? '✅ Question and answer regenerated!' : '✅ Question and answer regenerated for this session!')
    } catch (e: unknown) {
      toast.error(`❌ ${getErrorMessage(e)}`)
    } finally {
      setRegeneratingQuestion(null)
    }
  }

  const handleRegenerateWorksheetAnswer = async (
    groupKey: WorksheetQuestionGroup['key'],
    item: QuestionData & AnswerData,
    answerIndex: number,
  ) => {
    if (lesson.metadata?.is_published) {
      toast.message('This lesson is published and locked.')
      return
    }
    const token = `${groupKey}-${item.displayNumber ?? item.q_number ?? answerIndex}`
    setRegeneratingAnswer(token)
    try {
      const freshAnswer = await regenerateWorksheetAnswer({
        metadata: lesson.metadata,
        question: {
          q_number: item.originalNumber ?? item.q_number ?? item.displayNumber,
          display_number: item.displayNumber,
          question: item.question,
          marks: item.marks,
          section: groupKey,
        },
        current_answer: {
          answer: item.answer,
          explanation: item.explanation,
        },
        answer_key_instruction: buildAnswerKeyInstruction(),
      }, user?.id)

      const nextAnswerKey = replaceWorksheetAnswer(lesson.answer_key, item, {
        q_number: item.originalNumber ?? item.q_number ?? item.displayNumber,
        answer: freshAnswer.answer,
        explanation: freshAnswer.explanation,
      })
      const lessonId = lesson.id ?? lesson.metadata?.id

      if (lessonId && user?.id) {
        await saveLessonSections(lessonId, user.id, { answer_key: nextAnswerKey })
      }

      const next = {
        ...lesson,
        id: lessonId,
        answer_key: nextAnswerKey,
        metadata: { ...lesson.metadata, id: lessonId },
      }
      setLesson(next)
      sessionStorage.setItem('currentLesson', JSON.stringify(next))
      toast.success(lessonId ? '✅ Answer regenerated!' : '✅ Answer regenerated for this session!')
    } catch (e: unknown) {
      toast.error(`❌ ${getErrorMessage(e)}`)
    } finally {
      setRegeneratingAnswer(null)
    }
  }

  const updateStudentWorksheetAnswer = (key: string, value: string) => {
    setStudentWorksheetAnswers(current => ({ ...current, [key]: value }))
  }

  const saveStudentQuizAnswers = async (answers: StudentQuizAnswers) => {
    setStudentQuizAnswers(answers)
    const currentLessonId = lesson?.id ?? lesson?.metadata?.id
    if (!user?.id || !currentLessonId) return

    try {
      await saveQuizPracticeAnswers({
        userId: user.id,
        lessonId: currentLessonId,
        answers,
      })
    } catch (e: unknown) {
      toast.error(`❌ ${getErrorMessage(e, 'Could not save quiz practice')}`)
    }
  }

  const submitStudentWork = async (section: 'worksheet' | 'homework') => {
    if (isTeacher || !user?.id || !lesson) return
    if (section === 'homework' && homeworkSubmittedAt) return
    if (section === 'worksheet' && worksheetSubmittedAt) return

    if (section === 'homework') {
      const cleanAnswer = String(studentHomeworkAnswer || '').trim()
      if (!cleanAnswer) {
        toast.error('❌ Please type your homework answer before submitting.')
        return
      }
    }

    if (section === 'worksheet') {
      const answers = Object.values(studentWorksheetAnswers || {})
      const hasAnswers = answers.some(ans => ans && String(ans).trim())
      if (!hasAnswers) {
        toast.error('❌ Please answer at least one question before submitting your worksheet.')
        return
      }
    }

    const currentLessonId = lesson.id ?? lesson.metadata?.id
    const teacherId = lesson.metadata?.teacher_id
    if (!currentLessonId || !teacherId) {
      toast.error('❌ This lesson cannot accept submissions yet.')
      return
    }

    setSavingStudentWork(true)
    try {
      const submittedAt = new Date().toISOString()
      const submissionPayload: Record<string, unknown> = section === 'homework'
        ? {
            lesson_id: currentLessonId,
            student_id: user.id,
            teacher_id: teacherId,
            student_name: profile?.display_name || user.email || 'Student',
            grade: lesson.metadata.grade,
            worksheet_answers: studentWorksheetAnswers,
            homework_answer: studentHomeworkAnswer.trim(),
            homework_submitted_at: submittedAt,
            submitted_at: submittedAt,
            updated_at: submittedAt,
          }
        : {
            lesson_id: currentLessonId,
            student_id: user.id,
            teacher_id: teacherId,
            student_name: profile?.display_name || user.email || 'Student',
            grade: lesson.metadata.grade,
            worksheet_answers: studentWorksheetAnswers,
            homework_answer: studentHomeworkAnswer.trim(),
            worksheet_submitted_at: submittedAt,
            submitted_at: submittedAt,
            updated_at: submittedAt,
          }
      const { data, error } = await supabase
        .from('lesson_submissions')
        .upsert(submissionPayload, { onConflict: 'lesson_id,student_id' })
        .select('id')
        .single()

      if (error) throw error
      if (section === 'homework') {
        setHomeworkSubmittedAt(submittedAt)
        try {
          toast.message('Evaluating homework with AI...')
          const homeworkTask = String(lesson.lesson_plan?.homework?.description || lesson.lesson_plan?.homework?.activity || '')
          const evaluation = await evaluateHomeworkWithAi({
            lesson_id: currentLessonId,
            submission_id: data.id,
            student_id: user.id,
            metadata: lesson.metadata,
            lesson_plan: lesson.lesson_plan,
            homework_task: homeworkTask,
            homework_answer: studentHomeworkAnswer.trim(),
          })
          setAiHomeworkReview({
            understanding_level: evaluation.understanding_level,
            understanding_score: evaluation.understanding_score,
            feedback: evaluation.feedback,
            strengths: evaluation.strengths,
            improvements: evaluation.improvements,
            teacher_note: evaluation.teacher_note,
            evaluated_at: new Date().toISOString(),
          })
          toast.success('✅ Homework evaluated by AI!')
        } catch (evaluationError: unknown) {
          toast.error(`❌ ${getErrorMessage(evaluationError, 'Homework submitted, but AI evaluation failed')}`)
        }
      }
      if (section === 'worksheet') {
        setWorksheetSubmittedAt(submittedAt)
        try {
          toast.message('Checking worksheet with AI...')
          const grading = await gradeWorksheetWithAi({
            lesson_id: currentLessonId,
            submission_id: data.id,
            student_id: user.id,
            grade: lesson.metadata.grade,
            worksheet: lesson.worksheet,
            answer_key: lesson.answer_key,
            student_answers: studentWorksheetAnswers,
            total_marks: worksheetTotalMarks(lesson.worksheet) ?? 0,
          })
          setAiWorksheetReview({
            score: grading.score,
            grade: grading.grade,
            feedback: grading.overall_feedback,
            breakdown: grading.breakdown,
            graded_at: new Date().toISOString(),
          })
          toast.success('✅ Worksheet checked by AI!')
        } catch (gradingError: unknown) {
          toast.error(`❌ ${getErrorMessage(gradingError, 'Worksheet submitted, but AI grading failed')}`)
        }
      }
      toast.success(section === 'homework' ? '✅ Homework submitted!' : '✅ Worksheet submitted!')
    } catch (e: unknown) {
      toast.error(`❌ ${getErrorMessage(e, 'Could not submit your work')}`)
    } finally {
      setSavingStudentWork(false)
    }
  }

  const m = lesson.metadata
  const lessonLocked = isTeacher && Boolean(m.is_published)
  const availableExportOptions = isTeacher ? EXPORT_OPTIONS : STUDENT_EXPORT_OPTIONS
  const selectedExport = availableExportOptions.find(option => option.key === exportMode) ?? availableExportOptions[0]
  const downloadPdf = (mode: ExportMode = exportMode) => {
    const safeMode = availableExportOptions.some(option => option.key === mode) ? mode : 'full'
    setExportMode(safeMode)
    setExportMenuOpen(false)
    const option = availableExportOptions.find(item => item.key === safeMode) ?? availableExportOptions[0]
    const topicSlug = String(m.topic || 'lesson-kit').trim().replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'lesson-kit'
    const previousTitle = document.title
    document.title = `${topicSlug}-${option.key}.pdf`
    toast.message(`Preparing ${option.label} for PDF export...`)
    const restoreTitle = () => {
      document.title = previousTitle
      window.removeEventListener('afterprint', restoreTitle)
    }
    window.addEventListener('afterprint', restoreTitle)
    window.setTimeout(restoreTitle, 5000)
    window.setTimeout(() => window.print(), 120)
  }

  return (
    <div className="min-h-screen relative">
      <FloatingBlobs />
      <Header />
      <main className="relative max-w-5xl mx-auto px-4 sm:px-6 py-8">

        <div className="flex flex-wrap items-center justify-between gap-3 mb-8">
          <div className="flex flex-wrap gap-2">
            {isTeacher && (
              <button
                onClick={() => navigate({ to: '/' })}
                className="create-new-lesson-primary flex items-center gap-2 px-5 py-2.5 rounded-xl text-white font-semibold"
              >
                <Plus className="w-4 h-4" /> Create New
              </button>
            )}
            {!isTeacher && (
              <button
                type="button"
                onClick={() => navigate({ to: '/student' })}
                className="create-new-lesson-primary flex items-center gap-2 px-5 py-2.5 rounded-xl text-white font-semibold"
                style={{
                  background: 'linear-gradient(135deg,#1E6FD9,#4DA3FF)',
                  boxShadow: '0 8px 20px rgba(30,111,217,0.4)'
                }}
              >
                <ArrowLeft className="w-4 h-4" /> Back to Lessons
              </button>
            )}
          </div>
          <div className="relative">
            <div className="pdf-download-group flex rounded-xl overflow-hidden">
              <button
                onClick={() => downloadPdf()}
                className="pdf-download-button flex items-center gap-2 px-5 py-2.5 text-white font-semibold rounded-none"
                style={{
                  background: 'linear-gradient(135deg,#1E6FD9,#4DA3FF)',
                  boxShadow: '0 8px 20px rgba(30,111,217,0.4)'
                }}
              >
                <Download className="w-4 h-4" />
                <span>Download PDF</span>
              </button>
              <button
                type="button"
                aria-label="Choose PDF export type"
                onClick={(e) => {
                  e.stopPropagation()
                  setExportMenuOpen(open => !open)
                }}
                className="pdf-export-toggle px-2.5 text-white"
              >
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>
            {exportMenuOpen && (
              <div className="pdf-export-menu absolute right-0 mt-2 w-56 rounded-2xl border p-2 shadow-2xl z-30">
                <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-blue-300">Export</div>
                {availableExportOptions.map(option => (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => downloadPdf(option.key)}
                    className={`pdf-export-option w-full text-left rounded-xl px-3 py-2 text-sm transition ${selectedExport.key === option.key ? 'is-active' : ''}`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="text-center mb-5">
          <h1 className="text-4xl font-bold text-white capitalize">{m.topic}</h1>
        </div>

        <div
          className="rounded-3xl p-5 mb-8"
          style={{
            background: 'rgba(30,111,217,0.15)',
            border: '1px solid rgba(30,111,217,0.3)'
          }}
        >
          <div className="flex flex-wrap justify-center gap-2">
            {[m.subject, m.grade, m.duration, m.language].filter(Boolean).map((c, i) => (
              <span
                key={i}
                className="text-sm px-3 py-1.5 rounded-lg text-white"
                style={{
                  background: 'rgba(255,255,255,0.1)',
                  border: '1px solid rgba(255,255,255,0.15)'
                }}
              >
                {c}
              </span>
            ))}
          </div>
          {m.objectives && (
            <p className="text-xs italic text-blue-300 mt-3 text-center">
              Objectives: {m.objectives}
            </p>
          )}
        </div>

        {/* Tab Navigation */}
        <div
          className="flex flex-wrap gap-1.5 p-1.5 rounded-2xl border border-white/10 mb-6"
          style={{ background: 'rgba(255,255,255,0.06)' }}
        >
          {visibleTabs.map(t => (
            <button
              key={t.k}
              onClick={() => {
                setTab(t.k)
                setEditing(false)
                setDraft(null)
              }}
              className={`flex-1 min-w-[120px] py-2.5 px-3 rounded-xl text-sm font-semibold transition ${
                tab === t.k ? 'text-white' : 'text-white/50 hover:text-white/70'
              }`}
              style={
                tab === t.k
                  ? {
                      background: 'linear-gradient(to right,#2563eb,#3b82f6)',
                      boxShadow: '0 4px 15px rgba(30,111,217,0.4)'
                    }
                  : {}
              }
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* Section Actions */}
        {lessonLocked && (
          <div className="mb-4 rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
            This lesson is published and locked. Students can view it, but teacher edits and regeneration are disabled.
          </div>
        )}
        {isTeacher && !lessonLocked && (
        <div className="flex flex-wrap justify-end gap-2 mb-4">
          {editing ? (
            <>
              <button
                onClick={cancelEdit}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-white/70 text-sm border border-white/15 hover:bg-white/10 disabled:opacity-60"
                style={{ background: 'rgba(255,255,255,0.06)' }}
              >
                <X className="w-4 h-4" /> Cancel
              </button>
              <button
                onClick={saveEdit}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-semibold disabled:opacity-60"
                style={{ background: 'linear-gradient(135deg,#16a34a,#22c55e)' }}
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save Changes
              </button>
            </>
          ) : (
            <>
              <button
                onClick={startEdit}
                disabled={regen}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-white/80 text-sm border border-white/15 hover:bg-white/15 disabled:opacity-60"
                style={{ background: 'rgba(255,255,255,0.08)' }}
              >
                <Edit3 className="w-4 h-4" /> Edit Section
              </button>
              <button
                onClick={handleRegenerate}
                disabled={regen}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-white/80 text-sm border border-white/15 hover:bg-white/15 disabled:opacity-60"
                style={{ background: 'rgba(255,255,255,0.08)' }}
              >
                {regen
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <RefreshCw className="w-4 h-4" />
                }
                Regenerate Section
              </button>
            </>
          )}
        </div>
        )}

        {/* Tab Content */}
        {regen ? (
          <div
            className="rounded-3xl p-10 text-center border border-white/10"
            style={{ background: 'rgba(255,255,255,0.06)' }}
          >
            <Loader2 className="w-8 h-8 animate-spin text-blue-300 mx-auto mb-3" />
            <p className="text-white">Regenerating with AI...</p>
          </div>
        ) : editing ? (
          <SectionEditor tab={tab} data={draft ?? {}} onChange={setDraft} />
        ) : (
          <div>
            {tab === 'lesson_plan' && (
              <LessonPlanView data={lesson.lesson_plan} />
            )}
            {tab === 'homework' && (
              <HomeworkView
                data={lesson.lesson_plan?.homework}
                studentAnswer={isTeacher ? undefined : studentHomeworkAnswer}
                onStudentAnswerChange={isTeacher ? undefined : setStudentHomeworkAnswer}
                locked={Boolean(homeworkSubmittedAt)}
              />
            )}
            {tab === 'worksheet' && (
              <WorksheetView
                data={lesson.worksheet}
                regeneratingQuestion={isTeacher ? regeneratingQuestion : null}
                onRegenerateQuestion={isTeacher ? handleRegenerateWorksheetQuestion : undefined}
                studentAnswers={isTeacher ? undefined : studentWorksheetAnswers}
                onStudentAnswerChange={isTeacher ? undefined : updateStudentWorksheetAnswer}
                locked={Boolean(worksheetSubmittedAt)}
              />
            )}
            {tab === 'quiz' && (
              <QuizView
                data={lesson.quiz}
                answerKey={lesson.answer_key}
                interactive={!isTeacher}
                selectedAnswers={studentQuizAnswers}
                onSelectAnswer={saveStudentQuizAnswers}
              />
            )}
            {isTeacher && tab === 'answer_key' && (
              <AnswerKeyView
                data={lesson.answer_key}
                worksheet={lesson.worksheet}
                quiz={lesson.quiz}
                regeneratingAnswer={regeneratingAnswer}
                onRegenerateAnswer={handleRegenerateWorksheetAnswer}
              />
            )}
            {!isTeacher && (tab === 'worksheet' || tab === 'homework') && (
              <>
                <StudentSubmissionPanel
                  section={tab}
                  submittedAt={tab === 'homework' ? homeworkSubmittedAt : worksheetSubmittedAt}
                  saving={savingStudentWork}
                  locked={(tab === 'homework' && Boolean(homeworkSubmittedAt)) || (tab === 'worksheet' && Boolean(worksheetSubmittedAt))}
                  onSubmit={() => submitStudentWork(tab)}
                />
                {tab === 'worksheet' && aiWorksheetReview && <StudentAiWorksheetPanel review={aiWorksheetReview} />}
                {tab === 'homework' && aiHomeworkReview && <StudentAiHomeworkPanel review={aiHomeworkReview} />}
                {studentReviews[tab] && <StudentReviewPanel review={studentReviews[tab]} />}
              </>
            )}
          </div>
        )}

        {/* Print Content */}
        <div id="print-content" className="hidden print:block">
          <PrintAll lesson={lesson} mode={selectedExport.key} includeAnswerKey={isTeacher} />
        </div>
      </main>
    </div>
  )
}

/* ─── Shared Card ─────────────────────────────────────────── */
function Card({ children, accent, className = '' }: { children: ReactNode; accent?: string; className?: string }) {
  return (
    <div
      className={`rounded-3xl p-6 border border-white/10 backdrop-blur ${
        accent ? `border-l-4 ${accent}` : ''
      } ${className}`}
      style={{ background: 'rgba(255,255,255,0.06)' }}
    >
      {children}
    </div>
  )
}

function StudentSubmissionPanel({
  section,
  submittedAt,
  saving,
  locked,
  onSubmit,
}: {
  section: 'worksheet' | 'homework'
  submittedAt: string | null
  saving: boolean
  locked?: boolean
  onSubmit: () => void
}) {
  const sectionLabel = section === 'homework' ? 'homework' : 'worksheet'
  return (
    <Card className="mt-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h3 className="text-white font-bold">Submit your {sectionLabel}</h3>
          <p className="text-blue-200 text-sm mt-1">
            {submittedAt
              ? `Last submitted: ${new Date(submittedAt).toLocaleString()}`
              : `Your ${sectionLabel} will be sent to your teacher.`}
          </p>
        </div>
        <button
          type="button"
          onClick={onSubmit}
          disabled={saving || locked}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-white font-semibold disabled:opacity-60"
          style={{ background: 'linear-gradient(135deg,#16a34a,#22c55e)' }}
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {locked ? 'Submitted' : submittedAt ? 'Update Submission' : 'Submit Work'}
        </button>
      </div>
    </Card>
  )
}

function StudentAiWorksheetPanel({ review }: { review: AiWorksheetReview }) {
  return (
    <Card className="mt-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="text-white font-bold">AI Worksheet Check</h3>
          <p className="text-blue-200 text-sm mt-1">
            Checked {review.graded_at ? new Date(review.graded_at).toLocaleString() : ''}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {review.score != null && (
            <span className="rounded-full border border-emerald-400/30 bg-emerald-500/15 px-4 py-1.5 text-sm font-semibold text-emerald-200">
              Score: {review.score}
            </span>
          )}
          {review.grade && (
            <span className="rounded-full border border-blue-300/30 bg-blue-500/15 px-4 py-1.5 text-sm font-semibold text-blue-100">
              Grade: {review.grade}
            </span>
          )}
        </div>
      </div>
      {review.feedback && (
        <p className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4 text-white/85 whitespace-pre-wrap">
          {review.feedback}
        </p>
      )}
      {review.breakdown.length > 0 && (
        <div className="mt-4 space-y-2">
          {review.breakdown.map((item, index) => (
            <div key={index} className="rounded-2xl border border-white/10 bg-slate-950/20 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="font-semibold text-blue-200">Q{String(item.q_number ?? index + 1)}</span>
                <span className="text-emerald-200">
                  {String(item.marks_awarded ?? 0)} / {String(item.max_marks ?? 0)} marks
                </span>
              </div>
              {item.feedback != null && (
                <p className="mt-2 text-sm text-white/70 whitespace-pre-wrap">{String(item.feedback)}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}

function StudentAiHomeworkPanel({ review }: { review: AiHomeworkReview }) {
  return (
    <Card className="mt-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="text-white font-bold">AI Homework Feedback</h3>
          <p className="text-blue-200 text-sm mt-1">
            Evaluated {review.evaluated_at ? new Date(review.evaluated_at).toLocaleString() : ''}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {review.understanding_level && (
            <span className="rounded-full border border-blue-300/30 bg-blue-500/15 px-4 py-1.5 text-sm font-semibold text-blue-100">
              {review.understanding_level}
            </span>
          )}
          {review.understanding_score != null && (
            <span className="rounded-full border border-emerald-400/30 bg-emerald-500/15 px-4 py-1.5 text-sm font-semibold text-emerald-200">
              {review.understanding_score} / 5
            </span>
          )}
        </div>
      </div>
      {review.feedback && (
        <p className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4 text-white/85 whitespace-pre-wrap">
          {review.feedback}
        </p>
      )}
      <div className="mt-4 grid md:grid-cols-2 gap-3">
        <AiList title="Strengths" items={review.strengths} />
        <AiList title="Improve Next" items={review.improvements} />
      </div>
    </Card>
  )
}

function AiList({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/20 p-4">
      <h4 className="text-white font-semibold mb-2">{title}</h4>
      <ul className="space-y-2 text-sm text-white/75">
        {items.map((item, index) => (
          <li key={index}>{item}</li>
        ))}
      </ul>
    </div>
  )
}

function StudentReviewPanel({ review }: { review: StudentReview }) {
  return (
    <Card className="mt-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="text-white font-bold">Teacher Review</h3>
          <p className="text-blue-200 text-sm mt-1">
            Reviewed {review.reviewed_at ? new Date(review.reviewed_at).toLocaleString() : ''}
          </p>
        </div>
        {review.score != null && (
          <span className="rounded-full border border-emerald-400/30 bg-emerald-500/15 px-4 py-1.5 text-sm font-semibold text-emerald-200">
            Score: {review.score}
          </span>
        )}
      </div>
      {review.feedback ? (
        <p className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4 text-white/85 whitespace-pre-wrap">
          {review.feedback}
        </p>
      ) : (
        <p className="mt-4 text-white/50 text-sm">No written feedback added.</p>
      )}
    </Card>
  )
}

function Empty() {
  return (
    <Card>
      <p className="text-white/60 text-center">No content available.</p>
    </Card>
  )
}

function cloneValue<T>(value: T): T {
  if (typeof structuredClone === 'function') return structuredClone(value)
  return JSON.parse(JSON.stringify(value))
}

function SectionEditor({ tab, data, onChange }: { tab: TabKey; data: EditableValue; onChange: EditableChange }) {
  if (tab === 'lesson_plan') return <LessonPlanEditor data={data} onChange={onChange} />
  if (tab === 'homework') return <HomeworkEditor data={data} onChange={onChange} />
  if (tab === 'worksheet') return <WorksheetEditor data={data} onChange={onChange} />
  if (tab === 'quiz') return <QuizEditor data={data} onChange={onChange} />
  return <AnswerKeyEditor data={data} onChange={onChange} />
}

function EditorShell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-3xl p-5 sm:p-6 border border-blue-400/30 backdrop-blur space-y-5" style={{ background: 'rgba(30,111,217,0.12)' }}>
      <div>
        <h2 className="text-white font-bold text-xl">{title}</h2>
        <p className="text-blue-200 text-sm mt-1">Make changes here, then use Save Changes above.</p>
      </div>
      {children}
    </div>
  )
}

function EditField({
  label,
  value,
  onChange,
  rows = 1,
}: {
  label: string
  value?: string | number
  onChange: (value: string) => void
  rows?: number
}) {
  const commonClass = "w-full rounded-xl px-3 py-2.5 text-white placeholder-white/30 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20"
  return (
    <label className="block">
      <span className="text-xs font-semibold uppercase tracking-wide text-blue-200 mb-1.5 block">{label}</span>
      {rows > 1 ? (
        <textarea
          rows={rows}
          value={value ?? ''}
          onChange={e => onChange(e.target.value)}
          className={`${commonClass} resize-y`}
          style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.14)' }}
        />
      ) : (
        <input
          value={value ?? ''}
          onChange={e => onChange(e.target.value)}
          className={commonClass}
          style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.14)' }}
        />
      )}
    </label>
  )
}

function linesToArray(value: string) {
  return value.split('\n').map(v => v.trim()).filter(Boolean)
}

function arrayToLines(value: unknown) {
  return Array.isArray(value) ? value.join('\n') : ''
}

function LessonPlanEditor({ data, onChange }: { data: EditableValue; onChange: EditableChange }) {
  const updateSection = (key: string, field: string, value: unknown) => {
    const section = typeof data[key] === 'object' && data[key] !== null ? data[key] as EditableValue : {}
    onChange({ ...data, [key]: { ...section, [field]: value } })
  }

  return (
    <EditorShell title="Edit Lesson Plan">
      {LESSON_SECTIONS.map(({ key, label }) => {
        const section = (typeof data[key] === 'object' && data[key] !== null ? data[key] : {}) as LessonPlanSectionData
        return (
          <div key={key} className="rounded-2xl border border-white/10 p-4 space-y-3" style={{ background: 'rgba(255,255,255,0.05)' }}>
            <h3 className="text-white font-bold">{label}</h3>
            <EditField label="Duration" value={section.duration} onChange={v => updateSection(key, 'duration', v)} />
            <EditField label="Activity" rows={3} value={section.activity} onChange={v => updateSection(key, 'activity', v)} />
            <EditField label="Content" rows={4} value={section.content} onChange={v => updateSection(key, 'content', v)} />
            <EditField label="Description" rows={3} value={section.description} onChange={v => updateSection(key, 'description', v)} />
            <EditField label="Key Terms (one per line)" rows={3} value={arrayToLines(section.key_terms)} onChange={v => updateSection(key, 'key_terms', linesToArray(v))} />
            <EditField label="Materials (one per line)" rows={3} value={arrayToLines(section.materials)} onChange={v => updateSection(key, 'materials', linesToArray(v))} />
            <EditField label="Questions (one per line)" rows={3} value={arrayToLines(section.questions)} onChange={v => updateSection(key, 'questions', linesToArray(v))} />
            <EditField label="Purpose" rows={2} value={section.purpose} onChange={v => updateSection(key, 'purpose', v)} />
          </div>
        )
      })}
    </EditorShell>
  )
}

function HomeworkEditor({ data, onChange }: { data: EditableValue; onChange: EditableChange }) {
  const updateField = (field: string, value: unknown) => {
    onChange({ ...data, [field]: value })
  }

  return (
    <EditorShell title="Edit Homework">
      <div className="rounded-2xl border border-white/10 p-4 space-y-3" style={{ background: 'rgba(255,255,255,0.05)' }}>
        <EditField label="Duration" value={String(data.duration ?? '')} onChange={v => updateField('duration', v)} />
        <EditField label="Activity" rows={3} value={String(data.activity ?? '')} onChange={v => updateField('activity', v)} />
        <EditField label="Content" rows={4} value={String(data.content ?? '')} onChange={v => updateField('content', v)} />
        <EditField label="Description" rows={3} value={String(data.description ?? '')} onChange={v => updateField('description', v)} />
        <EditField label="Questions (one per line)" rows={3} value={arrayToLines(data.questions)} onChange={v => updateField('questions', linesToArray(v))} />
        <EditField label="Purpose" rows={2} value={String(data.purpose ?? '')} onChange={v => updateField('purpose', v)} />
      </div>
    </EditorShell>
  )
}

function WorksheetEditor({ data, onChange }: { data: EditableValue; onChange: EditableChange }) {
  const sections = Array.isArray(data.sections) ? data.sections as WorksheetSectionData[] : []
  const updateSection = (index: number, next: WorksheetSectionData) => {
    const nextSections = sections.map((section, i) => i === index ? next : section)
    onChange({ ...data, sections: nextSections })
  }

  return (
    <EditorShell title="Edit Worksheet">
      <EditField label="Instructions" rows={3} value={String(data.instructions ?? '')} onChange={v => onChange({ ...data, instructions: v })} />
      {sections.map((section, i) => (
        <div key={i} className="rounded-2xl border border-white/10 p-4 space-y-3" style={{ background: 'rgba(255,255,255,0.05)' }}>
          <EditField label={`Section ${i + 1} Title`} value={section.section_title} onChange={v => updateSection(i, { ...section, section_title: v })} />
          {(section.questions || []).map((q, j) => (
            <div key={j} className="rounded-xl border border-white/10 p-3 space-y-3">
              <EditField
                label={`Question ${j + 1}`}
                rows={3}
                value={typeof q === 'string' ? q : q.question ?? q.text ?? String(q)}
                onChange={v => {
                  const questions = (section.questions || []).map((item, idx) => {
                    if (idx !== j) return item
                    return typeof item === 'string' ? v : { ...item, question: v }
                  })
                  updateSection(i, { ...section, questions })
                }}
              />
              {typeof q !== 'string' && (
                <EditField
                  label="Marks"
                  value={q.marks}
                  onChange={v => {
                    const questions = (section.questions || []).map((item, idx) => idx === j && typeof item !== 'string' ? { ...item, marks: v } : item)
                    updateSection(i, { ...section, questions })
                  }}
                />
              )}
            </div>
          ))}
        </div>
      ))}
    </EditorShell>
  )
}

function QuizEditor({ data, onChange }: { data: EditableValue; onChange: EditableChange }) {
  const mcqs = Array.isArray(data.mcq) ? data.mcq as QuestionData[] : []
  const shortAnswers = Array.isArray(data.short_answer) ? data.short_answer as QuestionData[] : []
  const updateQuestion = (index: number, next: QuestionData) => {
    onChange({ ...data, mcq: mcqs.map((q, i) => i === index ? next : q) })
  }
  const updateShortAnswer = (index: number, next: QuestionData) => {
    onChange({ ...data, short_answer: shortAnswers.map((q, i) => i === index ? next : q) })
  }

  return (
    <EditorShell title="Edit Quiz">
      <EditField label="Instructions" rows={3} value={String(data.instructions ?? '')} onChange={v => onChange({ ...data, instructions: v })} />
      {mcqs.map((q, i) => (
        <div key={i} className="rounded-2xl border border-white/10 p-4 space-y-3" style={{ background: 'rgba(255,255,255,0.05)' }}>
          <EditField label={`Question ${i + 1}`} rows={3} value={q.question} onChange={v => updateQuestion(i, { ...q, question: v })} />
          <div className="grid sm:grid-cols-2 gap-3">
            {Object.entries(q.options || {}).map(([option, value]) => (
              <EditField
                key={option}
                label={`Option ${option}`}
                value={String(value)}
                onChange={v => updateQuestion(i, { ...q, options: { ...(q.options || {}), [option]: v } })}
              />
            ))}
          </div>
          <EditField label="Marks" value={q.marks} onChange={v => updateQuestion(i, { ...q, marks: v })} />
        </div>
      ))}
      {shortAnswers.length > 0 && (
        <div className="rounded-2xl border border-white/10 p-4 space-y-3" style={{ background: 'rgba(255,255,255,0.05)' }}>
          <h3 className="text-white font-bold">Short Answer Questions</h3>
          {shortAnswers.map((q, i) => (
            <div key={i} className="rounded-xl border border-white/10 p-3 space-y-3">
              <EditField label={`Question ${i + 1}`} rows={3} value={q.question} onChange={v => updateShortAnswer(i, { ...q, question: v })} />
              <div className="grid sm:grid-cols-2 gap-3">
                <EditField label="Marks" value={q.marks} onChange={v => updateShortAnswer(i, { ...q, marks: v })} />
              </div>
            </div>
          ))}
        </div>
      )}
    </EditorShell>
  )
}

function AnswerKeyEditor({ data, onChange }: { data: EditableValue; onChange: EditableChange }) {
  const worksheetAnswers = Array.isArray(data.worksheet_answers) ? data.worksheet_answers as AnswerData[] : []
  const quizAnswers = Array.isArray(data.quiz_answers) ? data.quiz_answers as AnswerData[] : []
  const gradingRubric = data.grading_rubric as { grade_bands?: RubricBand[] } | RubricBand[] | undefined
  const rubric = (Array.isArray(gradingRubric) ? gradingRubric : gradingRubric?.grade_bands) || []

  const updateAnswer = (kind: 'worksheet_answers' | 'quiz_answers', index: number, next: AnswerData) => {
    const answers = kind === 'worksheet_answers' ? worksheetAnswers : quizAnswers
    onChange({ ...data, [kind]: answers.map((answer, i) => i === index ? next : answer) })
  }

  const updateRubric = (index: number, next: RubricBand) => {
    if (!Array.isArray(gradingRubric) && gradingRubric?.grade_bands) {
      onChange({
        ...data,
        grading_rubric: {
          ...gradingRubric,
          grade_bands: rubric.map((band, i) => i === index ? next : band),
        },
      })
      return
    }
    onChange({ ...data, grading_rubric: rubric.map((band, i) => i === index ? next : band) })
  }

  return (
    <EditorShell title="Edit Answer Key">
      {Array.isArray(rubric) && rubric.length > 0 && (
        <div className="rounded-2xl border border-white/10 p-4 space-y-3" style={{ background: 'rgba(255,255,255,0.05)' }}>
          <h3 className="text-white font-bold">Grading Rubric</h3>
          {rubric.map((band, i) => (
            <div key={i} className="grid sm:grid-cols-3 gap-3">
              <EditField label="Grade" value={band.grade} onChange={v => updateRubric(i, { ...band, grade: v })} />
              <EditField label="Range" value={band.range} onChange={v => updateRubric(i, { ...band, range: v })} />
              <EditField label="Descriptor" value={band.descriptor} onChange={v => updateRubric(i, { ...band, descriptor: v })} />
            </div>
          ))}
        </div>
      )}
      <AnswerEditorGroup title="Worksheet Answers" answers={worksheetAnswers} onChange={(i, next) => updateAnswer('worksheet_answers', i, next)} />
      <AnswerEditorGroup title="Quiz Answers" answers={quizAnswers} onChange={(i, next) => updateAnswer('quiz_answers', i, next)} />
    </EditorShell>
  )
}

function AnswerEditorGroup({ title, answers, onChange }: { title: string; answers: AnswerData[]; onChange: (index: number, answer: AnswerData) => void }) {
  if (!answers.length) return null
  return (
    <div className="rounded-2xl border border-white/10 p-4 space-y-3" style={{ background: 'rgba(255,255,255,0.05)' }}>
      <h3 className="text-white font-bold">{title}</h3>
      {answers.map((answer, i) => (
        <div key={i} className="rounded-xl border border-white/10 p-3 space-y-3">
          <EditField label={`Answer ${answer.q_number || i + 1}`} rows={2} value={String(answer.answer ?? '')} onChange={v => onChange(i, { ...answer, answer: v })} />
          <EditField label="Explanation" rows={2} value={answer.explanation} onChange={v => onChange(i, { ...answer, explanation: v })} />
        </div>
      ))}
    </div>
  )
}

/* ─── Lesson Plan ─────────────────────────────────────────── */
const LESSON_SECTIONS = [
  { key: 'warm_up', label: 'Warm-Up', accent: 'border-amber-400' },
  { key: 'concept_introduction', label: 'Concept Introduction', accent: 'border-blue-400' },
  { key: 'guided_activity', label: 'Guided Activity', accent: 'border-emerald-400' },
  { key: 'recap', label: 'Recap', accent: 'border-purple-400' },
]

const HOMEWORK_SECTION = { key: 'homework', label: 'Homework', accent: 'border-orange-400' }

function LessonPlanView({ data }: { data: LessonPlan }) {
  if (!data) return <Empty />
  return (
    <div className="space-y-4">
      {LESSON_SECTIONS.map(({ key, label, accent }) => {
        const s = data[key as LessonPlanSectionKey] as LessonPlanSectionData | undefined
        if (!s) return null
        return <LessonSectionCard key={key} section={s} label={label} accent={accent} />
      })}
    </div>
  )
}

function HomeworkView({
  data,
  studentAnswer,
  onStudentAnswerChange,
  locked = false,
}: {
  data?: LessonPlanSectionData
  studentAnswer?: string
  onStudentAnswerChange?: (value: string) => void
  locked?: boolean
}) {
  if (!data) return <Empty />
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <h2 className="text-white text-2xl font-bold">Student Homework</h2>
      </div>
      <LessonSectionCard section={data} label={HOMEWORK_SECTION.label} accent={HOMEWORK_SECTION.accent} hideTitle />
      <Card>
        <h3 className="text-white font-bold text-lg mb-4">Student Response</h3>
        {onStudentAnswerChange ? (
          <textarea
            value={studentAnswer ?? ''}
            onChange={(event) => onStudentAnswerChange(event.target.value)}
            disabled={locked}
            rows={8}
            className="w-full rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-white placeholder:text-white/40 outline-none focus:border-blue-300/60 disabled:opacity-75 disabled:cursor-not-allowed"
            placeholder="Type your homework response here..."
          />
        ) : (
          <div className="space-y-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="border-b border-white/20 h-6" />
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}

function LessonSectionCard({
  section,
  label,
  accent,
  hideTitle = false,
}: {
  section: LessonPlanSectionData
  label: string
  accent: string
  hideTitle?: boolean
}) {
  return (
    <Card accent={accent}>
      {!hideTitle && (
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <h3 className="text-white font-bold text-lg">{label}</h3>
          {section.duration && (
            <span className="text-xs text-white/70 bg-white/10 rounded-full px-3 py-1">
              {section.duration}
            </span>
          )}
        </div>
      )}
      {section.activity && (
        <p className="text-blue-100 whitespace-pre-wrap">{cleanGeneratedText(section.activity)}</p>
      )}
      {section.content && (
        <p className="text-blue-100 whitespace-pre-wrap">{cleanGeneratedText(section.content)}</p>
      )}
      {section.description && (
        <p className="text-blue-100 whitespace-pre-wrap mt-2">{cleanGeneratedText(section.description)}</p>
      )}
      {Array.isArray(section.key_terms) && section.key_terms.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {section.key_terms.map((t: string, j: number) => (
            <span
              key={j}
              className="text-xs px-3 py-1 rounded-full text-blue-300"
              style={{
                background: 'rgba(59,130,246,0.2)',
                border: '1px solid rgba(96,165,250,0.3)'
              }}
            >
              {cleanGeneratedText(t)}
            </span>
          ))}
        </div>
      )}
      {Array.isArray(section.materials) && section.materials.length > 0 && (
        <ul className="mt-3 space-y-1">
          {section.materials.map((mat: string, j: number) => (
            <li key={j} className="text-blue-100 text-sm">
              <span className="text-emerald-400 mr-2">✓</span>{cleanGeneratedText(mat)}
            </li>
          ))}
        </ul>
      )}
      {Array.isArray(section.questions) && section.questions.length > 0 && (
        <ol className="mt-3 list-decimal list-inside space-y-1 text-blue-100 text-sm">
          {section.questions.map((q: string, j: number) => <li key={j}>{cleanGeneratedText(q)}</li>)}
        </ol>
      )}
      {section.purpose && (
        <p className="italic text-blue-300 text-sm mt-3">{cleanGeneratedText(section.purpose)}</p>
      )}
    </Card>
  )
}

function cleanGeneratedText(value: unknown) {
  return String(value ?? '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/__(.*?)__/g, '$1')
    .replace(/^\s*[-*]\s+/gm, '')
    .trim()
}

/* ─── Worksheet ───────────────────────────────────────────── */
const WORKSHEET_GROUPS: {
  key: 'worksheet_mcq' | 'one_sentence' | 'short' | 'long'
  label: string
  description: string
  match: (question: QuestionData) => boolean
}[] = [
  { key: 'worksheet_mcq', label: 'Section A - Multiple Choice Questions', description: '1 mark each', match: question => Boolean(question.isMcq) },
  { key: 'one_sentence', label: 'Section B - One Word / One Sentence Answer Questions', description: '1 mark each', match: question => !question.isMcq && marksFor(question) <= 1 },
  { key: 'short', label: 'Section C - Short Answer Questions', description: '2 marks each', match: question => !question.isMcq && marksFor(question) >= 2 && marksFor(question) < 5 },
  { key: 'long', label: 'Section D - Long Answer Questions', description: '5 marks each', match: question => !question.isMcq && marksFor(question) >= 5 },
] as const

function marksFor(q: QuestionData | string | undefined) {
  if (!q || typeof q === 'string') return 1
  const marks = Number(q?.marks)
  return Number.isFinite(marks) && marks > 0 ? marks : 1
}

function answerLinesForMarks(marks: number) {
  if (marks >= 5) return 7
  if (marks >= 3) return 5
  if (marks >= 2) return 4
  return 3
}

function worksheetMcqs(data?: Worksheet | EditableValue | null): QuestionData[] {
  if (Array.isArray(data?.mcq)) return data.mcq as QuestionData[]
  if (Array.isArray(data?.multiple_choice)) return data.multiple_choice as QuestionData[]
  if (Array.isArray(data?.multiple_choice_questions)) return data.multiple_choice_questions as QuestionData[]
  return []
}

function hasOptions(q: QuestionData | string | undefined) {
  return q && typeof q === 'object' && q.options && Object.keys(q.options).length > 0
}

function optionEntries(q: QuestionData) {
  return Object.entries(q?.options || {})
}

function worksheetQuestionAnswerKey(question: QuestionData) {
  return String(question.originalNumber ?? question.q_number ?? question.displayNumber ?? '')
}

function collectWorksheetQuestions(data?: Worksheet | EditableValue | null): WorksheetQuestionGroup[] {
  const sections = Array.isArray(data?.sections) ? data.sections as WorksheetSectionData[] : []
  const allQuestions: QuestionData[] = []

  worksheetMcqs(data).forEach((q) => {
    allQuestions.push({
      ...q,
      question: q.question ?? q.text ?? '',
      marks: 1,
      originalNumber: q.q_number,
      source: 'worksheet_mcq',
      isMcq: true,
    })
  })

  sections.forEach((section) => {
    const sectionTitle = String(section.section_title || section.title || '').toLowerCase()
    const isMcqSection = sectionTitle.includes('multiple choice') || sectionTitle.includes('mcq')
    ;(section.questions || []).forEach((q) => {
      const question = typeof q === 'string' ? q : (q.question ?? q.text ?? '')
      allQuestions.push({
        ...((typeof q === 'string') ? {} : q),
        question,
        marks: isMcqSection || hasOptions(q) ? 1 : marksFor(q),
        originalNumber: typeof q === 'string' ? undefined : q.q_number,
        source: section.section_title,
        isMcq: Boolean(isMcqSection || hasOptions(q)),
      })
    })
  })

  let number = 1
  return WORKSHEET_GROUPS.map(group => ({
    ...group,
    questions: allQuestions
      .filter(q => group.match(q))
      .map(q => ({ ...q, displayNumber: number++ })),
  })).filter(group => group.questions.length > 0)
}

function worksheetTotalMarks(worksheet?: Worksheet | EditableValue | null) {
  return collectWorksheetQuestions(worksheet).reduce(
    (sum, group) => sum + group.questions.reduce((groupSum, q) => groupSum + marksFor(q), 0),
    0
  )
}

function descriptorForGrade(rubric: RubricBand[], grade: string, fallback: string) {
  return rubric.find((band) => String(band?.grade || '').toUpperCase() === grade)?.descriptor || fallback
}

function worksheetGradeBands(totalMarks: number, sourceRubric: RubricBand[]) {
  if (!totalMarks) return []

  const aMin = Math.ceil(totalMarks * 0.8)
  const bMin = Math.ceil(totalMarks * 0.6)
  const cMin = Math.ceil(totalMarks * 0.4)

  return [
    {
      grade: 'A',
      range: `${aMin}-${totalMarks}`,
      descriptor: descriptorForGrade(sourceRubric, 'A', 'Excellent'),
    },
    {
      grade: 'B',
      range: `${bMin}-${Math.max(bMin, aMin - 1)}`,
      descriptor: descriptorForGrade(sourceRubric, 'B', 'Good'),
    },
    {
      grade: 'C',
      range: `${cMin}-${Math.max(cMin, bMin - 1)}`,
      descriptor: descriptorForGrade(sourceRubric, 'C', 'Satisfactory'),
    },
    {
      grade: 'D',
      range: `0-${Math.max(0, cMin - 1)}`,
      descriptor: descriptorForGrade(sourceRubric, 'D', 'Needs Improvement'),
    },
  ]
}

function WorksheetView({
  data,
  regeneratingQuestion,
  onRegenerateQuestion,
  studentAnswers,
  onStudentAnswerChange,
  locked = false,
}: {
  data: Worksheet
  regeneratingQuestion?: string | null
  onRegenerateQuestion?: (groupKey: WorksheetQuestionGroup['key'], question: QuestionData, questionIndex: number) => void
  studentAnswers?: StudentWorksheetAnswers
  onStudentAnswerChange?: (key: string, value: string) => void
  locked?: boolean
}) {
  if (!data) return <Empty />
  const total = worksheetTotalMarks(data)
  const groupedQuestions = collectWorksheetQuestions(data)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-white text-2xl font-bold">Student Worksheet</h2>
        {total != null && (
          <span
            className="worksheet-total-pill text-sm px-4 py-1.5 rounded-full text-white font-semibold"
          >
            Total: {total} marks
          </span>
        )}
      </div>

      {/* Instructions */}
      {data.instructions && (
        <Card>
          <p className="italic text-blue-200">{data.instructions}</p>
        </Card>
      )}

      {groupedQuestions.map(group => (
        <div key={group.key}>
          <div className="border-b border-white/10 pb-2 mb-4">
            <h3 className="text-white font-bold text-lg">{group.label}</h3>
            <p className="text-blue-300 text-sm mt-1">{group.description}</p>
          </div>
          <div className="space-y-3">
            {group.questions.map((q, questionIndex) => {
              const token = `${group.key}-${q.displayNumber ?? q.q_number ?? questionIndex}`
              const answerKey = worksheetQuestionAnswerKey(q)
              return (
                <WorksheetQuestionCard
                  key={`${group.key}-${q.displayNumber}`}
                  question={q}
                  regenerating={regeneratingQuestion === token}
                  onRegenerate={
                    onRegenerateQuestion
                      ? () => onRegenerateQuestion(group.key, q, questionIndex)
                      : undefined
                  }
                  studentAnswer={studentAnswers?.[answerKey] ?? ''}
                  onStudentAnswerChange={
                    onStudentAnswerChange && !locked
                      ? (value) => onStudentAnswerChange(answerKey, value)
                      : undefined
                  }
                  locked={locked}
                />
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

function WorksheetQuestionCard({
  question,
  regenerating,
  onRegenerate,
  studentAnswer,
  onStudentAnswerChange,
  locked = false,
}: {
  question: QuestionData
  regenerating?: boolean
  onRegenerate?: () => void
  studentAnswer?: string
  onStudentAnswerChange?: (value: string) => void
  locked?: boolean
}) {
  const marks = marksFor(question)
  const isStudentAnswering = Boolean(onStudentAnswerChange) && !locked
  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className={`text-white flex-1 ${question.isMcq ? 'font-semibold' : ''}`}>
          <span className="font-semibold">Q{question.displayNumber}.</span>{' '}
          {question.question}
        </p>
        <div className="flex gap-2 shrink-0">
          {onRegenerate && (
            <button
              type="button"
              onClick={onRegenerate}
              disabled={regenerating}
              className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-white/5 text-blue-200 border border-white/15 hover:bg-blue-400/10 disabled:opacity-60"
              title="Regenerate this question and its answer"
            >
              {regenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              <span>{regenerating ? 'Regenerating' : 'Regenerate'}</span>
            </button>
          )}
          {question.marks != null && (
            <span className="text-xs px-2.5 py-1 rounded-full bg-blue-500/20 text-blue-300 border border-blue-400/30">
              {marks}m
            </span>
          )}
        </div>
      </div>
      <div className={`mt-3 ${question.isMcq ? 'space-y-2' : 'space-y-3'}`}>
        {question.isMcq ? (
          optionEntries(question).map(([key, value]) => (
            <button
              key={key}
              type="button"
              onClick={() => onStudentAnswerChange?.(key)}
              disabled={!isStudentAnswering}
              className="w-full flex items-center gap-3 rounded-lg p-3 text-left"
              style={{
                background: studentAnswer === key ? 'rgba(59,130,246,0.22)' : 'rgba(255,255,255,0.05)',
                border: studentAnswer === key ? '1px solid rgba(96,165,250,0.6)' : '1px solid rgba(255,255,255,0.1)'
              }}
            >
              <div className={`w-5 h-5 rounded-full border shrink-0 ${studentAnswer === key ? 'border-blue-200 bg-blue-400' : 'border-white/30'}`} />
              <span className="text-white/70 font-medium w-4">{key}.</span>
              <span className="text-white/80">{String(value)}</span>
            </button>
          ))
        ) : onStudentAnswerChange || locked ? (
          <textarea
            value={studentAnswer ?? ''}
            onChange={(event) => onStudentAnswerChange?.(event.target.value)}
            disabled={locked}
            rows={answerLinesForMarks(marks)}
            className="w-full rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-white placeholder:text-white/40 outline-none focus:border-blue-300/60 disabled:opacity-75 disabled:cursor-not-allowed"
            placeholder="Type your answer here..."
          />
        ) : (
          Array.from({ length: answerLinesForMarks(marks) }).map((_, k) => (
            <div key={k} className="border-b border-white/20 h-8" />
          ))
        )}
      </div>
    </Card>
  )
}

/* ─── Quiz (MCQ only) ─────────────────────────────────────── */
function QuizView({
  data,
  answerKey,
  interactive = false,
  selectedAnswers = {},
  onSelectAnswer,
}: {
  data: Quiz
  answerKey?: AnswerKey
  interactive?: boolean
  selectedAnswers?: Record<string, string>
  onSelectAnswer?: (answers: Record<string, string>) => void
}) {
  if (!data) return (
    <div className="text-white/60 text-center py-8">
      Quiz data not available
    </div>
  )

  const mcqs = Array.isArray(data.mcq) ? data.mcq as QuestionData[] : []
  const mcqAnswers = getMcqAnswers(answerKey)
  const answerByQuestion = new Map(mcqAnswers.map((answer, index) => [String(answer.q_number ?? index + 1), String(answer.answer).toUpperCase()]))
  const getQuestionKey = (question: QuestionData, index: number) => String(question.q_number ?? index + 1)
  const getCorrectAnswer = (question: QuestionData, index: number) =>
    answerByQuestion.get(getQuestionKey(question, index)) ?? answerByQuestion.get(String(index + 1)) ?? ''
  const answeredCount = mcqs.filter((question, index) => Boolean(selectedAnswers[getQuestionKey(question, index)])).length
  const allMcqsAnswered = interactive && mcqs.length > 0 && answeredCount === mcqs.length
  const correctCount = mcqs.reduce((total, question, index) => {
    const selected = selectedAnswers[getQuestionKey(question, index)]
    const correct = getCorrectAnswer(question, index)
    return selected && correct && selected === correct ? total + 1 : total
  }, 0)

  if (mcqs.length === 0) {
    return (
      <div className="text-white/60 text-center py-8">
        No quiz questions available
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-white text-2xl font-bold">Quiz</h2>
        {allMcqsAnswered && (
          <div className="rounded-full border border-emerald-400/35 bg-emerald-500/15 px-4 py-2 text-sm font-semibold text-emerald-200">
            {correctCount} MCQs correct out of {mcqs.length}
          </div>
        )}
      </div>

      {/* Instructions */}
      {data.instructions && (
        <Card>
          <p className="italic text-blue-200">{data.instructions}</p>
        </Card>
      )}

      {/* Part A — MCQ Only */}
      <div>
        <h3 className="text-white font-bold text-lg border-b border-white/10 pb-2 mb-4">
          Part A — Multiple Choice
        </h3>
        <div className="space-y-3">
          {mcqs.map((q, j) => (
            <Card key={j}>
              <div className="flex justify-between gap-3 mb-3">
                <p className="text-white font-semibold flex-1">
                  Q{q.q_number || j + 1}. {q.question}
                </p>
              </div>
              <div className="space-y-2">
                {Object.entries(q.options || {}).map(([key, value]) => {
                  const questionKey = getQuestionKey(q, j)
                  const selected = selectedAnswers[questionKey]
                  const correct = getCorrectAnswer(q, j)
                  const optionKey = key.toUpperCase()
                  const hasAnswered = Boolean(selected)
                  const isSelected = selected === optionKey
                  const isCorrect = correct === optionKey
                  const showCorrect = interactive && hasAnswered && isCorrect
                  const showWrong = interactive && hasAnswered && isSelected && !isCorrect
                  return (
                    <button
                      key={key}
                      type="button"
                      disabled={!interactive || hasAnswered}
                      onClick={() => onSelectAnswer?.({ ...selectedAnswers, [questionKey]: optionKey })}
                      className="w-full flex items-center gap-3 rounded-lg p-3 text-left disabled:cursor-default"
                      style={{
                        background: showCorrect
                          ? 'rgba(34,197,94,0.18)'
                          : showWrong
                            ? 'rgba(239,68,68,0.18)'
                            : 'rgba(255,255,255,0.05)',
                        border: showCorrect
                          ? '1px solid rgba(74,222,128,0.55)'
                          : showWrong
                            ? '1px solid rgba(248,113,113,0.55)'
                            : '1px solid rgba(255,255,255,0.1)'
                      }}
                    >
                      <div className={`w-5 h-5 rounded-full border shrink-0 ${showCorrect ? 'border-emerald-300 bg-emerald-400' : showWrong ? 'border-red-300 bg-red-400' : isSelected ? 'border-blue-200 bg-blue-400' : 'border-white/30'}`} />
                      <span className="text-white/70 font-medium w-4">{key}.</span>
                      <span className="text-white/80 flex-1">{String(value)}</span>
                      {showCorrect && <span className="text-xs font-semibold text-emerald-300">Correct</span>}
                      {showWrong && <span className="text-xs font-semibold text-red-300">Wrong</span>}
                    </button>
                  )
                })}
              </div>
              {interactive && selectedAnswers[String(q.q_number ?? j + 1)] && (
                <QuizResult
                  selected={selectedAnswers[getQuestionKey(q, j)]}
                  correct={getCorrectAnswer(q, j)}
                />
              )}
            </Card>
          ))}
        </div>
      </div>
      {!interactive && mcqAnswers.length > 0 && (
        <div>
          <h3 className="text-white font-bold text-lg mb-3">
            Quiz MCQ Answers
          </h3>
          <div className="space-y-2">
            {mcqAnswers.map((a, j) => (
              <Card key={j}>
                <p className="flex items-center gap-3">
                  <span className="text-blue-300 font-semibold">
                    Q{a.q_number || j + 1}.
                  </span>
                  <span className="text-xs px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 font-semibold">
                    {a.answer}
                  </span>
                </p>
                {a.explanation && (
                  <p className="italic text-white/60 text-sm mt-2">
                    {a.explanation}
                  </p>
                )}
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function QuizResult({ selected, correct }: { selected: string; correct: string }) {
  const isCorrect = selected === correct
  return (
    <div className={`mt-3 rounded-xl border px-4 py-3 text-sm ${isCorrect ? 'border-emerald-400/35 bg-emerald-500/10 text-emerald-200' : 'border-red-400/35 bg-red-500/10 text-red-200'}`}>
      {isCorrect ? (
        <span className="font-semibold">Correct.</span>
      ) : (
        <span>
          <span className="font-semibold">Wrong.</span>{' '}
          Correct option: <span className="font-bold">{correct || 'Not available'}</span>
        </span>
      )}
    </div>
  )
}

/* ─── Answer Key ──────────────────────────────────────────── */
function AnswerKeyView({
  data,
  worksheet,
  quiz,
  regeneratingAnswer,
  onRegenerateAnswer,
}: {
  data: AnswerKey
  worksheet?: Worksheet
  quiz?: Quiz
  regeneratingAnswer?: string | null
  onRegenerateAnswer?: (groupKey: WorksheetQuestionGroup['key'], item: QuestionData & AnswerData, answerIndex: number) => void
}) {
  if (!data) return <Empty />

  const totalMarks = worksheetTotalMarks(worksheet)
  const sourceRubric = data.grading_rubric?.grade_bands || data.grading_rubric || []
  const rubric = worksheetGradeBands(totalMarks, Array.isArray(sourceRubric) ? sourceRubric : [])
  const worksheetAnswers = data.worksheet_answers || []
  const quizAnswers = data.quiz_answers || []
  const worksheetAnswerGroups = buildWorksheetAnswerGroups(worksheet, quiz, worksheetAnswers, quizAnswers)

  const gradeColor = (g: string) =>
    g?.startsWith('A') ? 'text-emerald-400' :
    g?.startsWith('B') ? 'text-blue-400' :
    g?.startsWith('C') ? 'text-amber-400' : 'text-red-400'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Key className="w-6 h-6 text-blue-300" />
        <h2 className="text-white text-2xl font-bold">
          Answer Key & Grading Rubric
        </h2>
      </div>

      {/* Grading Rubric */}
      {rubric.length > 0 && (
        <Card>
          {totalMarks && (
            <p className="text-blue-300 text-sm font-semibold mb-3">
              Total Marks: {totalMarks}
            </p>
          )}
          <table className="w-full text-sm">
            <thead>
              <tr
                className="text-blue-300 font-semibold"
                style={{ background: 'rgba(30,58,138,0.3)' }}
              >
                <th className="text-left p-3 rounded-l-xl">Grade</th>
                <th className="text-left p-3">Range</th>
                <th className="text-left p-3 rounded-r-xl">Descriptor</th>
              </tr>
            </thead>
            <tbody>
              {rubric.map((r, i) => (
                <tr
                  key={i}
                  style={{
                    background: i % 2 === 0
                      ? 'rgba(255,255,255,0.03)'
                      : 'transparent'
                  }}
                >
                  <td className={`p-3 font-bold ${gradeColor(r.grade)}`}>
                    {r.grade}
                  </td>
                  <td className="p-3 text-white/80">{r.range}</td>
                  <td className="p-3 text-white/80">{r.descriptor}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {worksheetAnswerGroups.length > 0 && (
        <div>
          <h3 className="text-white font-bold text-lg mb-3">
            Worksheet Answers
          </h3>
          <div className="space-y-5">
            {worksheetAnswerGroups.map(group => (
              <div key={group.key}>
                <div className="border-b border-white/10 pb-2 mb-3">
                  <h4 className="text-white font-semibold">{group.label}</h4>
                  <p className="text-blue-300 text-sm">{group.description}</p>
                </div>
                <div className="space-y-2">
                  {group.answers.map((item, answerIndex) => {
                    const token = `${group.key}-${item.displayNumber ?? item.q_number ?? answerIndex}`
                    const canRegenerateAnswer = group.key === 'short' || group.key === 'long'
                    return (
                      <AnswerKeyCard
                        key={`${group.key}-${item.displayNumber}`}
                        item={item}
                        regenerating={regeneratingAnswer === token}
                        onRegenerate={
                          canRegenerateAnswer && onRegenerateAnswer
                            ? () => onRegenerateAnswer(group.key, item, answerIndex)
                            : undefined
                        }
                      />
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  )
}

function buildWorksheetAnswerGroups(worksheet: Worksheet | undefined, quiz: Quiz | undefined, worksheetAnswers: AnswerData[], quizAnswers: AnswerData[]) {
  const allAnswerKeys = worksheetAnswers
  const groupedQuestions = collectWorksheetQuestions(worksheet)

  return groupedQuestions.map(group => ({
    ...group,
    answers: group.questions.map((question) => {
      const answer = findAnswerForQuestion(question, allAnswerKeys)
      return { ...question, answer: answer?.answer, explanation: answer?.explanation }
    }),
  })).filter(group => group.answers.length > 0)
}

function getMcqAnswers(answerKey?: AnswerKey) {
  const quizAnswers = answerKey?.quiz_answers || []
  return (quizAnswers as AnswerData[]).filter((a) =>
    typeof a.answer === 'string' &&
    a.answer.length === 1 &&
    ['A','B','C','D'].includes(a.answer.toUpperCase())
  )
}

function findAnswerForQuestion(question: QuestionData, answers: AnswerData[]) {
  const keys = [question.originalNumber, question.q_number, question.displayNumber].filter(v => v != null).map(String)
  return answers.find((answer) => keys.includes(String(answer.q_number))) ?? answers[Number(question.displayNumber) - 1]
}

function questionNumberForStorage(target: QuestionData, fallback: { q_number?: string | number }) {
  return target.originalNumber ?? target.q_number ?? target.displayNumber ?? fallback.q_number
}

function sectionMatchesGroup(section: WorksheetSectionData, groupKey: WorksheetQuestionGroup['key']) {
  const title = String(section.section_title || section.title || '').toLowerCase()
  if (groupKey === 'one_sentence') return title.includes('section b') || title.includes('one word') || title.includes('one sentence')
  if (groupKey === 'short') return title.includes('section c') || title.includes('short answer')
  if (groupKey === 'long') return title.includes('section d') || title.includes('long answer')
  return title.includes('multiple choice') || title.includes('mcq')
}

function replacementQuestion(target: QuestionData, fresh: QuestionData): QuestionData {
  return {
    ...fresh,
    q_number: questionNumberForStorage(target, fresh),
    marks: marksFor(target),
    ...(target.isMcq ? { isMcq: true } : {}),
  }
}

function replaceWorksheetQuestion(
  worksheet: Worksheet,
  groupKey: WorksheetQuestionGroup['key'],
  questionIndex: number,
  target: QuestionData,
  fresh: QuestionData,
): Worksheet {
  const next = cloneValue(worksheet) as EditableValue & {
    mcq?: QuestionData[]
    sections?: WorksheetSectionData[]
  }
  const nextQuestion = replacementQuestion(target, fresh)

  if (groupKey === 'worksheet_mcq') {
    const mcqs = worksheetMcqs(next)
    if (!Array.isArray(next.mcq)) next.mcq = mcqs
    next.mcq = mcqs.map((question, index) => index === questionIndex ? nextQuestion : question)
    return next as Worksheet
  }

  const sections = Array.isArray(next.sections) ? next.sections : []
  next.sections = sections.map((section) => {
    if (!sectionMatchesGroup(section, groupKey)) return section
    const questions = Array.isArray(section.questions) ? section.questions : []
    return {
      ...section,
      questions: questions.map((question, index) => index === questionIndex ? nextQuestion : question),
    }
  })

  return next as Worksheet
}

function replaceWorksheetAnswer(answerKey: AnswerKey, target: QuestionData, freshAnswer: AnswerData): AnswerKey {
  const next = cloneValue(answerKey) as EditableValue & { worksheet_answers?: AnswerData[] }
  const answers = Array.isArray(next.worksheet_answers) ? next.worksheet_answers : []
  const targetKeys = [target.originalNumber, target.q_number, target.displayNumber].filter(v => v != null).map(String)
  const fallbackIndex = Math.max(0, Number(target.displayNumber || 1) - 1)
  const answerIndex = answers.findIndex(answer => targetKeys.includes(String(answer.q_number)))
  const indexToReplace = answerIndex >= 0 ? answerIndex : fallbackIndex
  const replacement: AnswerData = {
    ...freshAnswer,
    q_number: questionNumberForStorage(target, freshAnswer),
  }

  next.worksheet_answers = answers.map((answer, index) => index === indexToReplace ? replacement : answer)
  if (indexToReplace >= answers.length) next.worksheet_answers.push(replacement)

  return next as AnswerKey
}

function AnswerKeyCard({
  item,
  regenerating,
  onRegenerate,
}: {
  item: QuestionData & AnswerData
  regenerating?: boolean
  onRegenerate?: () => void
}) {
  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-white/80 text-sm mb-2">
            <span className="text-blue-300 font-semibold">Q{item.displayNumber}.</span>{' '}
            {item.question}
          </p>
          <p className="text-emerald-300 font-bold leading-relaxed">{item.answer || 'Answer not available'}</p>
          {item.explanation && (
            <p className="italic text-white/60 text-sm mt-2">{item.explanation}</p>
          )}
        </div>
        <div className="flex gap-2 shrink-0">
          {onRegenerate && (
            <button
              type="button"
              onClick={onRegenerate}
              disabled={regenerating}
              className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-white/5 text-blue-200 border border-white/15 hover:bg-blue-400/10 disabled:opacity-60"
              title="Regenerate this answer"
            >
              {regenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              <span>{regenerating ? 'Regenerating' : 'Regenerate'}</span>
            </button>
          )}
          <span className="text-xs px-2.5 py-1 rounded-full bg-blue-500/20 text-blue-300 border border-blue-400/30">
            {item.marks}m
          </span>
        </div>
      </div>
    </Card>
  )
}

/* ─── Print ───────────────────────────────────────────────── */
function PrintAll({ lesson, mode, includeAnswerKey = true }: { lesson: LessonWithId; mode: ExportMode; includeAnswerKey?: boolean }) {
  const shouldPrint = (section: ExportMode) => mode === 'full' || mode === section
  const isFullKit = mode === 'full'
  return (
    <div className="print-doc text-black">
      {isFullKit && <PrintCover lesson={lesson} />}
      {shouldPrint('lesson_plan') && (
        <PrintPage title="Lesson Plan" pageBreakBefore={isFullKit}>
          <PrintLessonPlan data={lesson.lesson_plan} />
        </PrintPage>
      )}
      {shouldPrint('homework') && (
        <PrintPage title="Homework" pageBreakBefore={isFullKit}>
          <PrintHomework data={lesson.lesson_plan?.homework} />
        </PrintPage>
      )}
      {shouldPrint('quiz') && (
        <PrintPage title="Quiz" pageBreakBefore={isFullKit}>
          <PrintQuiz data={lesson.quiz} answerKey={includeAnswerKey ? lesson.answer_key : undefined} />
        </PrintPage>
      )}
      {shouldPrint('worksheet') && (
        <PrintPage title="Student Worksheet" pageBreakBefore={isFullKit}>
          <PrintWorksheet data={lesson.worksheet} />
        </PrintPage>
      )}
      {includeAnswerKey && shouldPrint('answer_key') && (
        <PrintPage title="Answer Key & Grading Rubric" pageBreakBefore={isFullKit}>
          <PrintAnswerKey data={lesson.answer_key} worksheet={lesson.worksheet} quiz={lesson.quiz} />
        </PrintPage>
      )}
    </div>
  )
}

function PrintCover({ lesson }: { lesson: LessonWithId }) {
  const m = lesson.metadata
  return (
    <section className="pb-6 border-b border-slate-300">
      <p className="text-sm uppercase tracking-wide text-slate-500">AI Teaching Studio</p>
      <h1 className="text-3xl font-bold capitalize mt-2">{m.topic}</h1>
      <div className="grid grid-cols-2 gap-3 mt-5 text-sm">
        <PrintMeta label="Subject" value={m.subject} />
        <PrintMeta label="Grade" value={m.grade} />
        <PrintMeta label="Duration" value={m.duration} />
        <PrintMeta label="Language" value={m.language} />
      </div>
      {m.objectives && (
        <div className="mt-5">
          <h2 className="text-sm font-bold text-slate-700">Learning Objectives</h2>
          <p className="text-sm mt-1 whitespace-pre-wrap">{m.objectives}</p>
        </div>
      )}
    </section>
  )
}

function PrintMeta({ label, value }: { label: string; value?: string }) {
  if (!value) return null
  return (
    <div className="border border-slate-300 rounded-lg p-3">
      <div className="text-[11px] uppercase text-slate-500">{label}</div>
      <div className="font-semibold">{value}</div>
    </div>
  )
}

function PrintPage({ title, children, pageBreakBefore }: { title: string; children: ReactNode; pageBreakBefore?: boolean }) {
  return (
    <section className={pageBreakBefore ? 'print-page print-page-break' : 'print-page'}>
      <h2 className="text-2xl font-bold mb-4 pb-2 border-b border-slate-300">{title}</h2>
      {children}
    </section>
  )
}

function PrintBlock({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <div className="mb-4 rounded-lg border border-slate-300 p-4 break-inside-avoid">
      {title && <h3 className="font-bold mb-2">{title}</h3>}
      <div className="text-sm leading-6">{children}</div>
    </div>
  )
}

function PrintLessonPlan({ data }: { data: LessonPlan }) {
  if (!data) return <p>No lesson plan available.</p>
  return (
    <div>
      {LESSON_SECTIONS.map(({ key, label }) => {
        const section = data[key as LessonPlanSectionKey] as LessonPlanSectionData | undefined
        if (!section) return null
        return <PrintLessonSection key={key} section={section} label={label} />
      })}
    </div>
  )
}

function PrintHomework({ data }: { data?: LessonPlanSectionData }) {
  if (!data) return <p>No homework available.</p>
  return (
    <>
      <PrintLessonSection section={data} label={HOMEWORK_SECTION.label} />
      <PrintBlock title="Student Response">
        <div className="space-y-6 pt-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="border-b border-slate-300 h-6" />
          ))}
        </div>
      </PrintBlock>
    </>
  )
}

function PrintLessonSection({ section, label }: { section: LessonPlanSectionData; label: string }) {
  return (
    <PrintBlock title={`${label}${section.duration ? ` (${section.duration})` : ''}`}>
      {section.activity && <p className="whitespace-pre-wrap">{cleanGeneratedText(section.activity)}</p>}
      {section.content && <p className="whitespace-pre-wrap mt-2">{cleanGeneratedText(section.content)}</p>}
      {section.description && <p className="whitespace-pre-wrap mt-2">{cleanGeneratedText(section.description)}</p>}
      {Array.isArray(section.key_terms) && section.key_terms.length > 0 && (
        <p className="mt-2"><strong>Key terms:</strong> {section.key_terms.map(cleanGeneratedText).join(', ')}</p>
      )}
      {Array.isArray(section.materials) && section.materials.length > 0 && (
        <List items={section.materials.map(cleanGeneratedText)} />
      )}
      {Array.isArray(section.questions) && section.questions.length > 0 && (
        <NumberedList items={section.questions.map(cleanGeneratedText)} />
      )}
      {section.purpose && <p className="italic mt-2">{cleanGeneratedText(section.purpose)}</p>}
    </PrintBlock>
  )
}

function PrintWorksheet({ data }: { data: Worksheet }) {
  if (!data) return <p>No worksheet available.</p>
  const groupedQuestions = collectWorksheetQuestions(data)
  return (
    <div>
      {data.instructions && <PrintBlock><p className="italic">{data.instructions}</p></PrintBlock>}
      {groupedQuestions.map(group => (
        <div key={group.key} className="mb-5">
          <h3 className="font-bold mb-1">{group.label}</h3>
          <p className="text-sm text-slate-600 mb-3">{group.description}</p>
          {group.questions.map(q => (
            <PrintWorksheetQuestion key={`${group.key}-${q.displayNumber}`} question={q} />
          ))}
        </div>
      ))}
    </div>
  )
}

function PrintWorksheetQuestion({ question }: { question: QuestionData }) {
  return (
    <PrintQuestion number={question.displayNumber ?? question.q_number ?? ''} marks={question.marks} options={question.isMcq ? question.options : undefined}>
      {question.question}
    </PrintQuestion>
  )
}

function PrintQuiz({ data, answerKey }: { data: Quiz; answerKey?: AnswerKey }) {
  const mcqs = Array.isArray(data?.mcq) ? data.mcq as QuestionData[] : []
  const mcqAnswers = getMcqAnswers(answerKey)
  if (!mcqs.length) return <p>No quiz questions available.</p>
  return (
    <div>
      {data.instructions && <PrintBlock><p className="italic">{data.instructions}</p></PrintBlock>}
      {mcqs.map((q, j) => (
        <PrintBlock key={j}>
          <p><strong>Q{q.q_number || j + 1}.</strong> {q.question}</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {Object.entries(q.options || {}).map(([key, value]) => (
              <div key={key} className="border border-slate-200 rounded p-2">
                <strong>{key}.</strong> {String(value)}
              </div>
            ))}
          </div>
        </PrintBlock>
      ))}
      {answerKey && <AnswerList title="Quiz MCQ Answers" answers={mcqAnswers} />}
    </div>
  )
}

function PrintAnswerKey({ data, worksheet, quiz }: { data: AnswerKey; worksheet?: Worksheet; quiz?: Quiz }) {
  if (!data) return <p>No answer key available.</p>
  const totalMarks = worksheetTotalMarks(worksheet)
  const sourceRubric = data.grading_rubric?.grade_bands || data.grading_rubric || []
  const rubric = worksheetGradeBands(totalMarks, Array.isArray(sourceRubric) ? sourceRubric : [])
  const worksheetAnswers = data.worksheet_answers || []
  const quizAnswers = data.quiz_answers || []
  const worksheetAnswerGroups = buildWorksheetAnswerGroups(worksheet, quiz, worksheetAnswers, quizAnswers)
  return (
    <div>
      {Array.isArray(rubric) && rubric.length > 0 && (
        <PrintBlock title="Grading Rubric">
          <p className="font-semibold mb-3">Total Marks: {totalMarks}</p>
          <table className="w-full text-left border-collapse">
            <thead>
              <tr>
                <th className="border border-slate-300 p-2">Grade</th>
                <th className="border border-slate-300 p-2">Range</th>
                <th className="border border-slate-300 p-2">Descriptor</th>
              </tr>
            </thead>
            <tbody>
              {rubric.map((r, i) => (
                <tr key={i}>
                  <td className="border border-slate-300 p-2 font-bold">{r.grade}</td>
                  <td className="border border-slate-300 p-2">{r.range}</td>
                  <td className="border border-slate-300 p-2">{r.descriptor}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </PrintBlock>
      )}
      {worksheetAnswerGroups.length > 0 && (
        <PrintBlock title="Worksheet Answers">
          {worksheetAnswerGroups.map(group => (
            <div key={group.key} className="mb-4">
              <h3 className="font-bold">{group.label}</h3>
              <p className="text-sm text-slate-600 mb-2">{group.description}</p>
              <ol className="list-decimal list-inside space-y-2">
                {group.answers.map((item) => (
                  <li key={`${group.key}-${item.displayNumber}`}>
                    <strong>{item.answer || 'Answer not available'}</strong>
                    {item.explanation && <span className="italic"> - {item.explanation}</span>}
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </PrintBlock>
      )}
    </div>
  )
}

function AnswerList({ title, answers }: { title: string; answers: AnswerData[] }) {
  if (!answers.length) return null
  return (
    <PrintBlock title={title}>
      <ol className="list-decimal list-inside space-y-2">
        {answers.map((a, i) => (
          <li key={i}>
            <strong>{a.answer}</strong>
            {a.explanation && <span className="italic"> - {a.explanation}</span>}
          </li>
        ))}
      </ol>
    </PrintBlock>
  )
}

function PrintQuestion({
  number,
  marks,
  options,
  children
}: {
  number: number | string
  marks?: number | string
  options?: Record<string, unknown>
  children: ReactNode
}) {
  const lineCount = answerLinesForMarks(marksFor({ marks }))
  return (
    <div className="mb-4 break-inside-avoid">
      <p className="text-sm">
        <strong>Q{number}.</strong> {children}
        {marks != null && <span> ({marks} marks)</span>}
      </p>
      {options && Object.keys(options).length > 0 ? (
        <div className="mt-2 grid grid-cols-2 gap-2">
          {Object.entries(options).map(([key, value]) => (
            <div key={key} className="border border-slate-200 rounded p-2">
              <strong>{key}.</strong> {String(value)}
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-3 space-y-3">
          {Array.from({ length: lineCount }).map((_, line) => <div key={line} className="border-b border-slate-300 h-6" />)}
        </div>
      )}
    </div>
  )
}

function List({ items }: { items: string[] }) {
  return (
    <ul className="list-disc list-inside mt-2">
      {items.map((item, i) => <li key={i}>{item}</li>)}
    </ul>
  )
}

function NumberedList({ items }: { items: string[] }) {
  return (
    <ol className="list-decimal list-inside mt-2">
      {items.map((item, i) => <li key={i}>{item}</li>)}
    </ol>
  )
}
