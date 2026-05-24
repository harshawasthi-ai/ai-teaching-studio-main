import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { ArrowLeft, BookOpen, ChevronDown, ClipboardCheck, Loader2, Save } from 'lucide-react'
import { toast } from 'sonner'
import { Header, FloatingBlobs } from '@/components/app/Layout'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/integrations/supabase/client'

interface LessonSummary {
  id: string
  subject: string
  grade: string
  topic: string
  created_at: string
  is_published?: boolean
}

interface SubmissionRow {
  id: string
  lesson_id: string
  student_id: string
  student_name: string
  grade: string
  worksheet_answers: Record<string, string>
  homework_answer: string
  score: number | null
  feedback: string
  reviewed_at: string | null
  worksheet_score: number | null
  worksheet_feedback: string
  worksheet_reviewed_at: string | null
  homework_score: number | null
  homework_feedback: string
  homework_reviewed_at: string | null
  ai_worksheet_score: number | null
  ai_worksheet_grade: string | null
  ai_worksheet_feedback: string
  ai_worksheet_breakdown: Array<Record<string, unknown>>
  ai_worksheet_graded_at: string | null
  ai_homework_understanding_level: string | null
  ai_homework_understanding_score: number | null
  ai_homework_feedback: string
  ai_homework_strengths: string[]
  ai_homework_improvements: string[]
  ai_homework_teacher_note: string
  ai_homework_evaluated_at: string | null
  worksheet_submitted_at: string | null
  homework_submitted_at: string | null
  submitted_at: string
  updated_at: string
}

export default function SubmissionsPage() {
  const navigate = useNavigate()
  const { user, loading: authLoading } = useAuth()
  const [lessons, setLessons] = useState<LessonSummary[]>([])
  const [submissions, setSubmissions] = useState<SubmissionRow[]>([])
  const [selectedLessonId, setSelectedLessonId] = useState<string>(() => {
    if (typeof window === 'undefined') return 'all'
    return new URLSearchParams(window.location.search).get('lesson') || 'all'
  })
  const [loading, setLoading] = useState(true)
  const [savingEvaluationId, setSavingEvaluationId] = useState<string | null>(null)

  useEffect(() => {
    if (authLoading || !user?.id) return

    let cancelled = false
    ;(async () => {
      setLoading(true)
      const [lessonResult, submissionResult] = await Promise.all([
        supabase
          .from('lessons')
          .select('id,subject,grade,topic,created_at,is_published')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('lesson_submissions')
          .select('id,lesson_id,student_id,student_name,grade,worksheet_answers,homework_answer,worksheet_submitted_at,homework_submitted_at,ai_worksheet_score,ai_worksheet_grade,ai_worksheet_feedback,ai_worksheet_breakdown,ai_worksheet_graded_at,ai_homework_understanding_level,ai_homework_understanding_score,ai_homework_feedback,ai_homework_strengths,ai_homework_improvements,ai_homework_teacher_note,ai_homework_evaluated_at,score,feedback,reviewed_at,worksheet_score,worksheet_feedback,worksheet_reviewed_at,homework_score,homework_feedback,homework_reviewed_at,submitted_at,updated_at')
          .eq('teacher_id', user.id)
          .order('submitted_at', { ascending: false }),
      ])

      if (cancelled) return

      if (lessonResult.error) {
        toast.error(`❌ ${lessonResult.error.message}`)
      }
      if (submissionResult.error) {
        toast.error(`❌ ${submissionResult.error.message}`)
      }

      setLessons((lessonResult.data || []) as LessonSummary[])
      setSubmissions(((submissionResult.data || []) as SubmissionRow[]).filter(isTeacherVisibleSubmission))
      setLoading(false)
    })()

    return () => { cancelled = true }
  }, [authLoading, user?.id])

  const lessonById = useMemo(() => {
    return new Map(lessons.map(lesson => [lesson.id, lesson]))
  }, [lessons])

  const visibleSubmissions = useMemo(() => {
    if (selectedLessonId === 'all') return submissions
    return submissions.filter(submission => submission.lesson_id === selectedLessonId)
  }, [selectedLessonId, submissions])

  const saveAiEvaluation = async (submissionId: string, section: 'worksheet' | 'homework', values: Partial<SubmissionRow>) => {
    setSavingEvaluationId(`${submissionId}-${section}`)
    const updatedAt = new Date().toISOString()
    const { error } = await supabase
      .from('lesson_submissions')
      .update({ ...values, updated_at: updatedAt })
      .eq('id', submissionId)

    setSavingEvaluationId(null)
    if (error) {
      toast.error(`❌ ${error.message}`)
      return
    }

    setSubmissions(current => current.map(submission => submission.id === submissionId
      ? { ...submission, ...values, updated_at: updatedAt }
      : submission
    ))
    toast.success(section === 'worksheet' ? '✅ Worksheet AI evaluation updated' : '✅ Homework AI evaluation updated')
  }

  return (
    <div className="min-h-screen relative">
      <FloatingBlobs />
      <Header />

      <main className="relative max-w-6xl mx-auto px-4 sm:px-6 py-10">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
          <div>
            <button
              type="button"
              onClick={() => navigate({ to: '/library' })}
              className="inline-flex items-center gap-2 text-sm text-blue-200 hover:text-white mb-4"
            >
              <ArrowLeft className="w-4 h-4" />
              Library
            </button>
            <h1 className="text-4xl font-bold text-white">Student Submissions</h1>
            <p className="text-blue-300 mt-2">Review worksheet answers and homework from your students.</p>
          </div>
          <div className="rounded-2xl border border-white/15 backdrop-blur px-5 py-3 text-center" style={{ background: 'rgba(255,255,255,0.06)' }}>
            <div className="text-2xl font-bold text-white">{submissions.length}</div>
            <div className="text-xs text-blue-300">Total submissions</div>
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 p-4 sm:p-5 mb-8" style={{ background: 'rgba(255,255,255,0.06)' }}>
          <label className="block text-sm text-blue-200 mb-2">Filter by lesson</label>
          <select
            value={selectedLessonId}
            onChange={(event) => setSelectedLessonId(event.target.value)}
            className="w-full rounded-2xl border border-white/15 bg-slate-900/80 px-4 py-3 text-white outline-none focus:border-blue-300/60"
          >
            <option value="all">All lessons</option>
            {lessons.map(lesson => (
              <option key={lesson.id} value={lesson.id}>
                {lesson.topic} - {lesson.grade}
              </option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="rounded-3xl border border-white/10 p-10 text-center" style={{ background: 'rgba(255,255,255,0.06)' }}>
            <Loader2 className="w-8 h-8 animate-spin text-blue-300 mx-auto mb-3" />
            <p className="text-white">Loading submissions...</p>
          </div>
        ) : visibleSubmissions.length === 0 ? (
          <div className="rounded-3xl border border-white/10 p-12 text-center" style={{ background: 'rgba(255,255,255,0.06)' }}>
            <ClipboardCheck className="w-10 h-10 text-blue-300 mx-auto mb-4" />
            <h2 className="text-white text-xl font-bold">No submissions yet</h2>
            <p className="text-blue-300 mt-2">Published lessons will appear here after students submit their work.</p>
          </div>
        ) : (
          <div className="space-y-5">
            {visibleSubmissions.map(submission => (
              <SubmissionCard
                key={submission.id}
                submission={submission}
                lesson={lessonById.get(submission.lesson_id)}
                savingEvaluationId={savingEvaluationId}
                onSaveAiEvaluation={saveAiEvaluation}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

function isTeacherVisibleSubmission(submission: SubmissionRow) {
  const hasWorksheetTimestamp = Boolean(submission.worksheet_submitted_at)
  const hasHomeworkTimestamp = Boolean(submission.homework_submitted_at)
  const hasWorksheetAnswers = Object.values(submission.worksheet_answers || {}).some(answer => String(answer || '').trim() !== '')
  const hasHomeworkAnswer = String(submission.homework_answer || '').trim() !== ''
  return hasWorksheetTimestamp || hasHomeworkTimestamp || hasWorksheetAnswers || hasHomeworkAnswer
}

function SubmissionCard({
  submission,
  lesson,
  savingEvaluationId,
  onSaveAiEvaluation,
}: {
  submission: SubmissionRow
  lesson?: LessonSummary
  savingEvaluationId: string | null
  onSaveAiEvaluation: (submissionId: string, section: 'worksheet' | 'homework', values: Partial<SubmissionRow>) => void
}) {
  const answers = Object.entries(submission.worksheet_answers || {})
  const [expanded, setExpanded] = useState(false)

  return (
    <article className="rounded-3xl border border-white/10 p-5 sm:p-6" style={{ background: 'rgba(255,255,255,0.06)' }}>
      <button
        type="button"
        onClick={() => setExpanded(value => !value)}
        className={`w-full flex flex-wrap items-start justify-between gap-4 text-left ${expanded ? 'mb-5' : ''}`}
      >
        <div>
          <div className="flex items-center gap-2 text-blue-300 text-sm mb-2">
            <BookOpen className="w-4 h-4" />
            <span>{lesson ? `${lesson.topic} - ${lesson.grade}` : submission.grade}</span>
          </div>
          <h2 className="text-white text-xl font-bold">{submission.student_name || 'Student'}</h2>
          <p className="text-blue-200 text-sm mt-1">
            Submitted {new Date(submission.submitted_at).toLocaleString()}
          </p>
        </div>
        <ChevronDown className={`mt-2 w-5 h-5 text-blue-200 transition ${expanded ? 'rotate-180' : ''}`} />
      </button>

      {expanded && (
      <>
      <div className="grid lg:grid-cols-2 gap-4">
        <section className="rounded-2xl border border-white/10 p-4 bg-white/5">
          <h3 className="text-white font-bold mb-3">Worksheet Answers</h3>
          {answers.length === 0 ? (
            <p className="text-white/50 text-sm">No worksheet answers submitted.</p>
          ) : (
            <div className="space-y-3">
              {answers
                .sort(([a], [b]) => Number(a) - Number(b))
                .map(([questionNumber, answer]) => (
                  <div key={questionNumber} className="rounded-xl border border-white/10 bg-slate-950/20 px-3 py-2">
                    <div className="text-blue-300 text-xs font-semibold mb-1">Q{questionNumber}</div>
                    <p className="text-white/85 whitespace-pre-wrap">{answer || 'No answer'}</p>
                  </div>
                ))}
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-white/10 p-4 bg-white/5">
          <h3 className="text-white font-bold mb-3">Homework</h3>
          <p className="text-white/85 whitespace-pre-wrap">
            {submission.homework_answer || 'No homework response submitted.'}
          </p>
        </section>
      </div>

      {submission.ai_worksheet_graded_at && (
        <EditableAiWorksheetEvaluation
          submission={submission}
          saving={savingEvaluationId === `${submission.id}-worksheet`}
          onSave={(values) => onSaveAiEvaluation(submission.id, 'worksheet', values)}
        />
      )}

      {submission.ai_homework_evaluated_at && (
        <EditableAiHomeworkEvaluation
          submission={submission}
          saving={savingEvaluationId === `${submission.id}-homework`}
          onSave={(values) => onSaveAiEvaluation(submission.id, 'homework', values)}
        />
      )}
      </>
      )}
    </article>
  )
}

function AiList({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null
  return (
    <div className="rounded-xl border border-white/10 bg-slate-950/20 p-3">
      <h4 className="text-white font-semibold text-sm mb-2">{title}</h4>
      <ul className="space-y-1 text-xs text-white/70">
        {items.map((item, index) => (
          <li key={index}>{item}</li>
        ))}
      </ul>
    </div>
  )
}

function EditableAiWorksheetEvaluation({
  submission,
  saving,
  onSave,
}: {
  submission: SubmissionRow
  saving: boolean
  onSave: (values: Partial<SubmissionRow>) => void
}) {
  const [editing, setEditing] = useState(false)
  const [score, setScore] = useState(submission.ai_worksheet_score == null ? '' : String(submission.ai_worksheet_score))
  const [grade, setGrade] = useState(submission.ai_worksheet_grade || '')
  const [feedback, setFeedback] = useState(submission.ai_worksheet_feedback || '')

  useEffect(() => {
    setScore(submission.ai_worksheet_score == null ? '' : String(submission.ai_worksheet_score))
    setGrade(submission.ai_worksheet_grade || '')
    setFeedback(submission.ai_worksheet_feedback || '')
  }, [submission.ai_worksheet_feedback, submission.ai_worksheet_grade, submission.ai_worksheet_score])

  const handleSave = () => {
    const normalizedScore = score.trim() === '' ? null : Number(score)
    if (normalizedScore != null && (!Number.isFinite(normalizedScore) || normalizedScore < 0)) {
      toast.error('❌ Enter a valid worksheet score')
      return
    }
    onSave({
      ai_worksheet_score: normalizedScore,
      ai_worksheet_grade: grade.trim(),
      ai_worksheet_feedback: feedback.trim(),
    })
    setEditing(false)
  }

  return (
    <section className="mt-4 rounded-2xl border border-emerald-400/20 p-4 bg-emerald-500/10">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-white font-bold">Final Worksheet Evaluation</h3>
          <p className="text-emerald-100/80 text-xs mt-1">
            AI checked {submission.ai_worksheet_graded_at ? new Date(submission.ai_worksheet_graded_at).toLocaleString() : ''}
          </p>
        </div>
        <button
          type="button"
          onClick={editing ? handleSave : () => setEditing(true)}
          disabled={saving}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-white font-semibold disabled:opacity-60"
          style={{ background: 'linear-gradient(135deg,#16a34a,#22c55e)' }}
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {editing ? 'Save' : 'Edit'}
        </button>
      </div>

      {editing ? (
        <div className="mt-4 grid gap-3 md:grid-cols-[140px_140px_1fr]">
          <label className="block">
            <span className="block text-sm text-blue-100 mb-2">Score</span>
            <input type="number" min="0" value={score} onChange={(event) => setScore(event.target.value)} className="w-full rounded-2xl border border-white/15 bg-slate-950/30 px-4 py-3 text-white outline-none focus:border-blue-300/60" />
          </label>
          <label className="block">
            <span className="block text-sm text-blue-100 mb-2">Grade</span>
            <input value={grade} onChange={(event) => setGrade(event.target.value)} className="w-full rounded-2xl border border-white/15 bg-slate-950/30 px-4 py-3 text-white outline-none focus:border-blue-300/60" />
          </label>
          <label className="block">
            <span className="block text-sm text-blue-100 mb-2">Feedback</span>
            <textarea value={feedback} onChange={(event) => setFeedback(event.target.value)} rows={3} className="w-full rounded-2xl border border-white/15 bg-slate-950/30 px-4 py-3 text-white outline-none focus:border-blue-300/60" />
          </label>
        </div>
      ) : (
        <>
          <div className="mt-3 flex flex-wrap gap-2">
            {submission.ai_worksheet_score != null && <span className="rounded-full border border-emerald-300/30 bg-emerald-500/15 px-4 py-1.5 text-sm font-semibold text-emerald-100">Score: {submission.ai_worksheet_score}</span>}
            {submission.ai_worksheet_grade && <span className="rounded-full border border-blue-300/30 bg-blue-500/15 px-4 py-1.5 text-sm font-semibold text-blue-100">Grade: {submission.ai_worksheet_grade}</span>}
          </div>
          {submission.ai_worksheet_feedback && <p className="mt-3 rounded-xl border border-white/10 bg-slate-950/20 p-3 text-white/85 whitespace-pre-wrap">{submission.ai_worksheet_feedback}</p>}
        </>
      )}

      {Array.isArray(submission.ai_worksheet_breakdown) && submission.ai_worksheet_breakdown.length > 0 && (
        <div className="mt-3 grid sm:grid-cols-2 gap-2">
          {submission.ai_worksheet_breakdown.map((item, index) => (
            <div key={index} className="rounded-xl border border-white/10 bg-slate-950/20 p-3">
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="font-semibold text-blue-200">Q{String(item.q_number ?? index + 1)}</span>
                <span className="text-emerald-200">{String(item.marks_awarded ?? 0)} / {String(item.max_marks ?? 0)}</span>
              </div>
              {item.feedback != null && <p className="mt-2 text-xs text-white/65 whitespace-pre-wrap">{String(item.feedback)}</p>}
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

function EditableAiHomeworkEvaluation({
  submission,
  saving,
  onSave,
}: {
  submission: SubmissionRow
  saving: boolean
  onSave: (values: Partial<SubmissionRow>) => void
}) {
  const [editing, setEditing] = useState(false)
  const [level, setLevel] = useState(submission.ai_homework_understanding_level || '')
  const [score, setScore] = useState(submission.ai_homework_understanding_score == null ? '' : String(submission.ai_homework_understanding_score))
  const [feedback, setFeedback] = useState(submission.ai_homework_feedback || '')
  const [strengths, setStrengths] = useState((submission.ai_homework_strengths || []).join('\n'))
  const [improvements, setImprovements] = useState((submission.ai_homework_improvements || []).join('\n'))
  const [teacherNote, setTeacherNote] = useState(submission.ai_homework_teacher_note || '')

  useEffect(() => {
    setLevel(submission.ai_homework_understanding_level || '')
    setScore(submission.ai_homework_understanding_score == null ? '' : String(submission.ai_homework_understanding_score))
    setFeedback(submission.ai_homework_feedback || '')
    setStrengths((submission.ai_homework_strengths || []).join('\n'))
    setImprovements((submission.ai_homework_improvements || []).join('\n'))
    setTeacherNote(submission.ai_homework_teacher_note || '')
  }, [submission])

  const lines = (value: string) => value.split('\n').map(item => item.trim()).filter(Boolean)
  const handleSave = () => {
    const normalizedScore = score.trim() === '' ? null : Number(score)
    if (normalizedScore != null && (!Number.isFinite(normalizedScore) || normalizedScore < 1 || normalizedScore > 5)) {
      toast.error('❌ Enter an understanding score from 1 to 5')
      return
    }
    onSave({
      ai_homework_understanding_level: level.trim(),
      ai_homework_understanding_score: normalizedScore,
      ai_homework_feedback: feedback.trim(),
      ai_homework_strengths: lines(strengths),
      ai_homework_improvements: lines(improvements),
      ai_homework_teacher_note: teacherNote.trim(),
    })
    setEditing(false)
  }

  return (
    <section className="mt-4 rounded-2xl border border-blue-300/20 p-4 bg-blue-500/10">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-white font-bold">Final Homework Evaluation</h3>
          <p className="text-blue-100/80 text-xs mt-1">
            AI evaluated {submission.ai_homework_evaluated_at ? new Date(submission.ai_homework_evaluated_at).toLocaleString() : ''}
          </p>
        </div>
        <button type="button" onClick={editing ? handleSave : () => setEditing(true)} disabled={saving} className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-white font-semibold disabled:opacity-60" style={{ background: 'linear-gradient(135deg,#16a34a,#22c55e)' }}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {editing ? 'Save' : 'Edit'}
        </button>
      </div>

      {editing ? (
        <div className="mt-4 grid gap-3">
          <div className="grid md:grid-cols-2 gap-3">
            <label className="block">
              <span className="block text-sm text-blue-100 mb-2">Understanding Level</span>
              <input value={level} onChange={(event) => setLevel(event.target.value)} className="w-full rounded-2xl border border-white/15 bg-slate-950/30 px-4 py-3 text-white outline-none focus:border-blue-300/60" />
            </label>
            <label className="block">
              <span className="block text-sm text-blue-100 mb-2">Understanding Score</span>
              <input type="number" min="1" max="5" value={score} onChange={(event) => setScore(event.target.value)} className="w-full rounded-2xl border border-white/15 bg-slate-950/30 px-4 py-3 text-white outline-none focus:border-blue-300/60" />
            </label>
          </div>
          <label className="block">
            <span className="block text-sm text-blue-100 mb-2">Student Feedback</span>
            <textarea value={feedback} onChange={(event) => setFeedback(event.target.value)} rows={3} className="w-full rounded-2xl border border-white/15 bg-slate-950/30 px-4 py-3 text-white outline-none focus:border-blue-300/60" />
          </label>
          <div className="grid md:grid-cols-2 gap-3">
            <label className="block">
              <span className="block text-sm text-blue-100 mb-2">Strengths</span>
              <textarea value={strengths} onChange={(event) => setStrengths(event.target.value)} rows={3} className="w-full rounded-2xl border border-white/15 bg-slate-950/30 px-4 py-3 text-white outline-none focus:border-blue-300/60" />
            </label>
            <label className="block">
              <span className="block text-sm text-blue-100 mb-2">Improvements</span>
              <textarea value={improvements} onChange={(event) => setImprovements(event.target.value)} rows={3} className="w-full rounded-2xl border border-white/15 bg-slate-950/30 px-4 py-3 text-white outline-none focus:border-blue-300/60" />
            </label>
          </div>
          <label className="block">
            <span className="block text-sm text-blue-100 mb-2">Teacher Note</span>
            <textarea value={teacherNote} onChange={(event) => setTeacherNote(event.target.value)} rows={2} className="w-full rounded-2xl border border-white/15 bg-slate-950/30 px-4 py-3 text-white outline-none focus:border-blue-300/60" />
          </label>
        </div>
      ) : (
        <>
          <div className="mt-3 flex flex-wrap gap-2">
            {submission.ai_homework_understanding_level && <span className="rounded-full border border-blue-300/30 bg-blue-500/15 px-4 py-1.5 text-sm font-semibold text-blue-100">{submission.ai_homework_understanding_level}</span>}
            {submission.ai_homework_understanding_score != null && <span className="rounded-full border border-emerald-300/30 bg-emerald-500/15 px-4 py-1.5 text-sm font-semibold text-emerald-100">{submission.ai_homework_understanding_score} / 5</span>}
          </div>
          {submission.ai_homework_feedback && <p className="mt-3 rounded-xl border border-white/10 bg-slate-950/20 p-3 text-white/85 whitespace-pre-wrap">{submission.ai_homework_feedback}</p>}
          <div className="mt-3 grid sm:grid-cols-2 gap-3">
            <AiList title="Strengths" items={submission.ai_homework_strengths || []} />
            <AiList title="Improvements" items={submission.ai_homework_improvements || []} />
          </div>
          {submission.ai_homework_teacher_note && <p className="mt-3 rounded-xl border border-white/10 bg-slate-950/20 p-3 text-sm text-white/70 whitespace-pre-wrap">Teacher note: {submission.ai_homework_teacher_note}</p>}
        </>
      )}
    </section>
  )
}
