import { useState, useEffect, FormEvent } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import { Sparkles, Loader2 } from 'lucide-react'
import { Header, FloatingBlobs } from '@/components/app/Layout'
import { useAuth } from '@/contexts/AuthContext'
import { generateLesson } from '@/lib/generateLesson'
import { buildAnswerKeyInstruction, buildWorksheetFormatInstruction, getGradeLevelGuidance } from '@/lib/gradeGuidance'

const LOADING_STEPS = [
  'Analyzing your topic...',
  'Creating lesson plan...',
  'Generating worksheet...',
  'Building quiz questions...',
  'Preparing answer key...',
  'Almost ready...',
]

const DURATIONS = ['30 minutes', '45 minutes', '60 minutes', '90 minutes']
const FIXED_QUIZ_MCQ_COUNT = 10
const GRADES = Array.from({ length: 12 }, (_, i) => `Grade ${i + 1}`)
const SUBJECTS_BY_GRADE: Record<string, string[]> = {
  'Grade 1': ['English', 'Mathematics', 'Hindi'],
  'Grade 2': ['English', 'Mathematics', 'Hindi'],
  'Grade 3': ['English', 'Mathematics', 'Hindi', 'The World Around Us', 'Arts', 'Physical Education and Well being'],
  'Grade 4': ['English', 'Mathematics', 'Hindi', 'The World Around Us', 'Arts', 'Physical Education and Well being'],
  'Grade 5': ['English', 'Mathematics', 'Hindi', 'The World Around Us', 'Arts', 'Physical Education and Well being'],
  'Grade 6': ['English', 'Mathematics', 'Hindi', 'Arts', 'Physical Education and Well being', 'Social Science', 'Science', 'Sanskrit', 'Vocational Education'],
  'Grade 7': ['English', 'Mathematics', 'Hindi', 'Arts', 'Physical Education and Well being', 'Social Science', 'Science', 'Sanskrit', 'Vocational Education'],
  'Grade 8': ['English', 'Mathematics', 'Hindi', 'Arts', 'Physical Education and Well being', 'Social Science', 'Science', 'Sanskrit', 'Vocational Education'],
  'Grade 9': ['English', 'Mathematics', 'Hindi', 'Arts', 'Physical Education and Well being', 'Social Science', 'Science', 'Sanskrit', 'ICT', 'Skill Education'],
  'Grade 10': ['Mathematics', 'Science', 'Social Science', 'Hindi', 'English', 'Sanskrit', 'Health and Physical Education'],
  'Grade 11': ['Sanskrit', 'Accountancy', 'Chemistry', 'Mathematics', 'Biology', 'Psychology', 'Geography', 'Physics', 'Hindi', 'Sociology', 'English', 'Political Science', 'History', 'Economics', 'Business Studies', 'Home Science', 'Creative Writing and Translation', 'Fine Art', 'Informatics Practices', 'Computer Science', 'Health and Physical Education', 'Biotechnology', 'Sangeet', 'Knowledge Traditions Practices of India'],
  'Grade 12': ['Sanskrit', 'Accountancy', 'Chemistry', 'Mathematics', 'Biology', 'Psychology', 'Geography', 'Physics', 'Hindi', 'Sociology', 'English', 'Political Science', 'History', 'Economics', 'Business Studies', 'Home Science', 'Creative Writing and Translation', 'Fine Art', 'Informatics Practices', 'Computer Science', 'Biotechnology', 'Sangeet'],
}

const QUESTION_CONTROLS = [
  { key: 'worksheetMcqQuestions', label: 'MCQs', hint: 'Section A - 1 mark', min: 0, max: 10 },
  { key: 'oneMarkQuestions', label: 'One word / one sentence', hint: 'Section B - 1 mark', min: 0, max: 10 },
  { key: 'twoMarkQuestions', label: 'Short answer questions', hint: 'Section C - 2 marks', min: 0, max: 10 },
  { key: 'fiveMarkQuestions', label: 'Long answer questions', hint: 'Section D - 5 marks', min: 0, max: 10 },
] as const

function getErrorMessage(error: unknown, fallback = 'Generation failed') {
  return error instanceof Error ? error.message : fallback
}

export default function InputPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [form, setForm] = useState({
    subject: '',
    grade: '',
    topic: '',
    duration: '45 minutes',
    objectives: '',
    language: 'English',
    worksheetMcqQuestions: 2,
    oneMarkQuestions: 2,
    twoMarkQuestions: 2,
    fiveMarkQuestions: 1,
  })
  const [errors, setErrors] = useState<Record<string, boolean>>({})
  const [submitErr, setSubmitErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [stepIdx, setStepIdx] = useState(0)
  const [progress, setProgress] = useState(0)
  const subjectOptions = SUBJECTS_BY_GRADE[form.grade] || []

  useEffect(() => {
    if (!loading) return
    setStepIdx(0); setProgress(0)
    const stepInt = setInterval(() => setStepIdx(i => (i + 1) % LOADING_STEPS.length), 4000)
    const start = Date.now()
    const progInt = setInterval(() => {
      const elapsed = Date.now() - start
      setProgress(Math.min(95, (elapsed / 30000) * 100))
    }, 200)
    return () => { clearInterval(stepInt); clearInterval(progInt) }
  }, [loading])

  const set = (k: keyof typeof form) => (v: string) => setForm(f => ({ ...f, [k]: v }))
  const setGrade = (grade: string) => setForm(f => ({
    ...f,
    grade,
    subject: SUBJECTS_BY_GRADE[grade]?.includes(f.subject) ? f.subject : '',
  }))
  const setNumber = (k: keyof typeof form) => (v: number) => setForm(f => ({ ...f, [k]: v }))

  const submit = async (e: FormEvent) => {
    e.preventDefault(); setSubmitErr(null)
    const required: (keyof typeof form)[] = ['subject', 'grade', 'topic', 'objectives']
    const errs: Record<string, boolean> = {}
    required.forEach(k => { if (!String(form[k]).trim()) errs[k] = true })
    setErrors(errs); if (Object.keys(errs).length) return

    setLoading(true)
    const timeout = setTimeout(() => { setLoading(false); setSubmitErr('Request timed out. Please try again.') }, 90000)
    try {
      const gradeLevelGuidance = getGradeLevelGuidance(form.grade)
      const lessonData = await generateLesson({
        ...form,
        question_controls: {
          worksheet_mcq: form.worksheetMcqQuestions,
          one_mark: form.oneMarkQuestions,
          two_mark: form.twoMarkQuestions,
          five_mark: form.fiveMarkQuestions,
          mcq: FIXED_QUIZ_MCQ_COUNT,
        },
        grade_level_guidance: gradeLevelGuidance,
        worksheet_format_instruction: buildWorksheetFormatInstruction({
          worksheetMcqQuestions: form.worksheetMcqQuestions,
          oneMarkQuestions: form.oneMarkQuestions,
          twoMarkQuestions: form.twoMarkQuestions,
          fiveMarkQuestions: form.fiveMarkQuestions,
          quizMcqQuestions: FIXED_QUIZ_MCQ_COUNT,
          gradeGuidance: gradeLevelGuidance,
        }),
        answer_key_instruction: buildAnswerKeyInstruction(),
      }, user?.id)
      clearTimeout(timeout)
      sessionStorage.setItem('currentLesson', JSON.stringify(lessonData))
      toast.success('✅ Lesson generated and saved!')
      navigate({ to: lessonData.id ? `/lesson/${lessonData.id}` : '/lesson' })
    } catch (e: unknown) {
      clearTimeout(timeout)
      const message = getErrorMessage(e)
      setSubmitErr(message)
      toast.error(`❌ ${message}`)
    } finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen relative">
      <FloatingBlobs />
      <Header />
      <main className="relative max-w-3xl mx-auto px-4 sm:px-6 py-10">
        <div className="text-center mb-10">
          <div className="inline-block text-xs text-blue-300 bg-white/10 backdrop-blur border border-white/20 rounded-full px-4 py-2 mb-6">✨ AI-Powered Lesson Generator</div>
          <h1 className="text-4xl sm:text-5xl font-bold text-white leading-tight">
            Create Lesson Kits<br />
            <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">Instantly with AI</span>
          </h1>
          <p className="text-blue-200 text-base sm:text-lg mt-4 max-w-xl mx-auto">Generate professional lesson plans, worksheets, quizzes and answer keys in 20 seconds.</p>
        </div>

        <div className="relative rounded-[28px] border border-white/10 backdrop-blur-xl p-6 sm:p-10" style={{ background: 'rgba(255,255,255,0.06)' }}>
          <div className="h-1 bg-gradient-to-r from-blue-500 to-cyan-400 rounded-full mb-8" />
          <h2 className="text-white text-2xl font-bold">Create Your Lesson Kit</h2>
          <p className="text-blue-200 text-sm mb-6">Fill in the details and we'll generate everything you need.</p>

          <form onSubmit={submit} className="space-y-5">
            <label className="block">
              <span className="text-sm text-blue-200 mb-1.5 block">Grade / Level</span>
              <select value={form.grade} onChange={e => setGrade(e.target.value)} disabled={loading}
                className="w-full rounded-2xl px-4 py-3.5 text-white outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20"
                style={{ background: 'rgba(255,255,255,0.06)', border: `1px solid ${errors.grade ? 'rgb(248,113,113)' : 'rgba(255,255,255,0.12)'}` }}>
                <option value="" className="bg-slate-900">Select grade</option>
                {GRADES.map(grade => <option key={grade} value={grade} className="bg-slate-900">{grade}</option>)}
              </select>
              {errors.grade && <span className="text-xs text-red-300 mt-1 block">Required</span>}
            </label>
            <label className="block">
              <span className="text-sm text-blue-200 mb-1.5 block">Subject</span>
              <select value={form.subject} onChange={e => set('subject')(e.target.value)} disabled={loading || !form.grade}
                className="w-full rounded-2xl px-4 py-3.5 text-white outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20 disabled:opacity-60"
                style={{ background: 'rgba(255,255,255,0.06)', border: `1px solid ${errors.subject ? 'rgb(248,113,113)' : 'rgba(255,255,255,0.12)'}` }}>
                <option value="" className="bg-slate-900">{form.grade ? 'Select subject' : 'Select grade first'}</option>
                {subjectOptions.map(subject => <option key={subject} value={subject} className="bg-slate-900">{subject}</option>)}
              </select>
              {errors.subject && <span className="text-xs text-red-300 mt-1 block">Required</span>}
            </label>
            <Field label="Topic" value={form.topic} onChange={set('topic')} placeholder="e.g. Fractions, Photosynthesis" error={errors.topic} disabled={loading} />

            <label className="block">
              <span className="text-sm text-blue-200 mb-1.5 block">Class Duration</span>
              <select value={form.duration} onChange={e => set('duration')(e.target.value)} disabled={loading}
                className="w-full rounded-2xl px-4 py-3.5 text-white outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }}>
                {DURATIONS.map(d => <option key={d} value={d} className="bg-slate-900">{d}</option>)}
              </select>
            </label>

            <label className="block">
              <span className="text-sm text-blue-200 mb-1.5 block">Learning Objectives</span>
              <textarea rows={3} value={form.objectives} onChange={e => set('objectives')(e.target.value)} disabled={loading}
                placeholder="What should students learn by end of lesson?"
                className={`w-full rounded-2xl px-4 py-3.5 text-white outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20 resize-none ${errors.objectives ? 'border-red-400' : ''}`}
                style={{ background: 'rgba(255,255,255,0.06)', border: `1px solid ${errors.objectives ? 'rgb(248,113,113)' : 'rgba(255,255,255,0.12)'}` }} />
              {errors.objectives && <span className="text-xs text-red-300 mt-1 block">Required</span>}
            </label>

            <div className="rounded-2xl border border-white/10 p-4 sm:p-5" style={{ background: 'rgba(255,255,255,0.05)' }}>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                <div>
                  <h3 className="text-white font-bold">Worksheet Question Controls</h3>
                  <p className="text-blue-200 text-sm">Choose number of Questions to be generated in worksheet.</p>
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                {QUESTION_CONTROLS.map(control => (
                  <QuestionCountControl
                    key={control.key}
                    label={control.label}
                    hint={control.hint}
                    value={Number(form[control.key])}
                    min={control.min}
                    max={control.max}
                    disabled={loading}
                    onChange={setNumber(control.key)}
                  />
                ))}
              </div>
            </div>

            <div>
              <span className="text-sm text-blue-200 mb-1.5 block">Output Language</span>
              <div className="flex gap-1 p-1 rounded-2xl bg-white/5 border border-white/10 w-fit">
                {(['English', 'Hindi'] as const).map(l => (
                  <button type="button" key={l} disabled={loading} onClick={() => set('language')(l)}
                    className={`px-6 py-2 rounded-xl text-sm font-medium transition ${form.language === l ? 'text-white' : 'text-white/60'}`}
                    style={form.language === l ? { background: 'linear-gradient(135deg,#3b82f6,#2563eb)' } : {}}>
                    {l}
                  </button>
                ))}
              </div>
              {form.language === 'Hindi' && (
                <div className="inline-block mt-2 text-xs text-blue-300 bg-blue-900/30 rounded px-3 py-1">📝 All content will be generated in Hindi</div>
              )}
            </div>

            {submitErr && (
              <div className="text-sm text-red-300 bg-red-500/10 border border-red-400/30 rounded-2xl px-4 py-3 backdrop-blur flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <span>{submitErr}</span>
                <button
                  type="submit"
                  className="shrink-0 rounded-xl px-4 py-2 text-white font-semibold bg-red-500/20 hover:bg-red-500/30 border border-red-300/25"
                >
                  Try Again
                </button>
              </div>
            )}

            {loading ? (
              <div className="rounded-2xl p-6 text-center border border-white/10" style={{ background: 'rgba(255,255,255,0.06)' }}>
                <Loader2 className="w-6 h-6 animate-spin text-blue-300 mx-auto mb-3" />
                <div className="text-white font-semibold mb-3">{LOADING_STEPS[stepIdx]}</div>
                <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 transition-all" style={{ width: `${progress}%` }} />
                </div>
              </div>
            ) : (
              <button type="submit"
                className="generate-lesson-button w-full py-4 rounded-2xl text-white font-bold flex items-center justify-center gap-2"
                style={{ background: 'linear-gradient(135deg,#1E6FD9,#4DA3FF)', boxShadow: '0 8px 30px rgba(30,111,217,0.5)' }}>
                <Sparkles className="w-5 h-5" /> {submitErr ? 'Try Again' : 'Generate Lesson Kit'}
              </button>
            )}
          </form>
        </div>
      </main>
    </div>
  )
}

function QuestionCountControl({
  label,
  hint,
  value,
  min,
  max,
  disabled,
  onChange,
}: {
  label: string
  hint: string
  value: number
  min: number
  max: number
  disabled?: boolean
  onChange: (value: number) => void
}) {
  const update = (next: number) => onChange(Math.max(min, Math.min(max, Number.isFinite(next) ? next : min)))

  return (
    <div className="rounded-xl border border-white/10 p-3" style={{ background: 'rgba(255,255,255,0.05)' }}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-white font-semibold text-sm">{label}</div>
          <div className="text-blue-300 text-xs">{hint}</div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={disabled || value <= min}
            onClick={() => update(value - 1)}
            className="h-8 w-8 rounded-lg border border-white/15 text-white disabled:opacity-40 hover:bg-white/10"
          >
            -
          </button>
          <input
            value={value}
            disabled={disabled}
            onChange={e => update(Number(e.target.value))}
            inputMode="numeric"
            className="h-8 w-12 rounded-lg text-center text-white outline-none"
            style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }}
          />
          <button
            type="button"
            disabled={disabled || value >= max}
            onClick={() => update(value + 1)}
            className="h-8 w-8 rounded-lg border border-white/15 text-white disabled:opacity-40 hover:bg-white/10"
          >
            +
          </button>
        </div>
      </div>
    </div>
  )
}

function Field({ label, value, onChange, placeholder, error, disabled }: { label: string; value: string; onChange: (v: string) => void; placeholder: string; error?: boolean; disabled?: boolean }) {
  return (
    <label className="block">
      <span className="text-sm text-blue-200 mb-1.5 block">{label}</span>
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} disabled={disabled}
        className="w-full rounded-2xl px-4 py-3.5 text-white placeholder-white/30 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20"
        style={{ background: 'rgba(255,255,255,0.06)', border: `1px solid ${error ? 'rgb(248,113,113)' : 'rgba(255,255,255,0.12)'}` }} />
      {error && <span className="text-xs text-red-300 mt-1 block">Required</span>}
    </label>
  )
}
