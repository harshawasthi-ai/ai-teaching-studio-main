import { useEffect, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { BarChart3, BookOpen, GraduationCap, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Header, FloatingBlobs } from '@/components/app/Layout'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/integrations/supabase/client'

interface StudentLessonRow {
  id: string
  subject: string
  grade: string
  topic: string
  duration: string
  language: string
  published_at: string | null
}

export default function StudentHomePage() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [lessons, setLessons] = useState<StudentLessonRow[] | null>(null)

  useEffect(() => {
    if (!profile?.grade) return
    ;(async () => {
      const { data, error } = await supabase
        .from('lessons')
        .select('id,subject,grade,topic,duration,language,published_at')
        .eq('is_published', true)
        .eq('grade', profile.grade)
        .order('published_at', { ascending: false })
        .limit(50)

      if (error) {
        toast.error(`❌ ${error.message}`)
        setLessons([])
        return
      }
      setLessons(data || [])
    })()
  }, [profile?.grade])

  return (
    <div className="min-h-screen relative">
      <FloatingBlobs />
      <Header />
      <main className="relative max-w-4xl mx-auto px-4 sm:px-6 py-10">
        <div className="rounded-3xl border border-white/10 backdrop-blur-xl p-8 sm:p-10" style={{ background: 'rgba(255,255,255,0.06)' }}>
          <div className="flex flex-col sm:flex-row sm:items-center gap-5">
            <div className="grid h-14 w-14 place-items-center rounded-2xl shrink-0" style={{ background: 'linear-gradient(135deg,#4f46e5,#7c3aed)' }}>
              <GraduationCap className="w-7 h-7 text-white" />
            </div>
            <div>
              <p className="text-blue-300 text-sm font-semibold">{profile?.grade || 'Student workspace'}</p>
              <h1 className="text-white text-3xl font-bold mt-1">Your Lessons</h1>
              <p className="text-blue-200 mt-2">
                Lessons assigned to your grade will appear here. You will be able to open worksheets, answer questions, and submit your work.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => navigate({ to: '/analytics' })}
            className="mt-6 inline-flex items-center gap-2 rounded-2xl px-5 py-3 text-white font-semibold"
            style={{ background: 'linear-gradient(135deg,#1E6FD9,#4DA3FF)', boxShadow: '0 8px 20px rgba(30,111,217,0.35)' }}
          >
            <BarChart3 className="w-4 h-4" />
            View Analytics
          </button>
        </div>

        {lessons === null ? (
          <div className="mt-6 rounded-3xl border border-white/10 backdrop-blur-xl p-8 text-center" style={{ background: 'rgba(255,255,255,0.05)' }}>
            <Loader2 className="w-7 h-7 text-blue-300 animate-spin mx-auto mb-3" />
            <h2 className="text-white text-xl font-bold">Loading lessons</h2>
            <p className="text-blue-200 text-sm mt-2">Checking what has been published for {profile?.grade || 'your grade'}.</p>
          </div>
        ) : lessons.length === 0 ? (
          <div className="mt-6 rounded-3xl border border-white/10 backdrop-blur-xl p-8 text-center" style={{ background: 'rgba(255,255,255,0.05)' }}>
            <BookOpen className="w-8 h-8 text-blue-300 mx-auto mb-3" />
            <h2 className="text-white text-xl font-bold">No assigned lessons yet</h2>
            <p className="text-blue-200 text-sm mt-2">
              Once a teacher publishes lessons for {profile?.grade || 'your grade'}, they will show up here.
            </p>
          </div>
        ) : (
          <div className="mt-6 grid sm:grid-cols-2 gap-4">
            {lessons.map(lesson => (
              <button
                key={lesson.id}
                type="button"
                onClick={() => navigate({ to: `/lesson/${lesson.id}` })}
                className="text-left rounded-3xl border border-white/10 backdrop-blur-xl p-5 hover:-translate-y-1 transition"
                style={{ background: 'rgba(255,255,255,0.06)' }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-blue-300 text-xs font-semibold">{lesson.subject} · {lesson.duration}</p>
                    <h2 className="text-white text-xl font-bold capitalize mt-2">{lesson.topic}</h2>
                  </div>
                  <BookOpen className="w-5 h-5 text-blue-300 shrink-0" />
                </div>
                <p className="text-blue-200 text-sm mt-4">Open worksheet and quiz</p>
              </button>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
