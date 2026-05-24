import { AlertTriangle, Loader2, Sparkles } from 'lucide-react'
import { Link } from '@tanstack/react-router'
import { useAuth } from '@/contexts/AuthContext'

export function AppStateScreen({
  state,
  title,
  message,
}: {
  state: 'loading' | 'not-found'
  title?: string
  message?: string
}) {
  const { profile } = useAuth()
  const isStudent = profile?.role === 'student'

  return (
    <div className="min-h-screen relative overflow-hidden">
      <div className="pointer-events-none fixed -top-32 -left-32 w-[28rem] h-[28rem] rounded-full bg-blue-600 blur-3xl opacity-20" />
      <div className="pointer-events-none fixed -bottom-32 -right-32 w-[32rem] h-[32rem] rounded-full bg-indigo-600 blur-3xl opacity-15" />
      <main className="relative min-h-screen flex items-center justify-center px-4">
        <div className="w-full max-w-md rounded-3xl border border-white/10 backdrop-blur-xl p-8 text-center" style={{ background: 'rgba(255,255,255,0.06)' }}>
          {state === 'loading' ? (
            <>
              <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl" style={{ background: 'linear-gradient(135deg,#4f46e5,#7c3aed)' }}>
                <Loader2 className="w-6 h-6 animate-spin text-white" />
              </div>
              <h1 className="text-white text-xl font-bold">{title || 'Opening AI Teaching Studio'}</h1>
              <p className="text-blue-200 text-sm mt-2">{message || 'Checking your session...'}</p>
            </>
          ) : (
            <>
              <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-blue-500/15 text-blue-300 border border-blue-400/25">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h1 className="text-white text-2xl font-bold">{title || 'Page not found'}</h1>
              <p className="text-blue-200 text-sm mt-2">{message || "That page doesn't exist or has moved."}</p>
              <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
                {isStudent ? (
                  <Link to="/student" className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-white font-semibold" style={{ background: 'linear-gradient(135deg,#1E6FD9,#4DA3FF)', boxShadow: '0 8px 20px rgba(30,111,217,0.35)' }}>
                    <Sparkles className="w-4 h-4" /> Student Home
                  </Link>
                ) : (
                  <>
                    <Link to="/library" className="px-5 py-3 rounded-xl text-white font-semibold border border-white/15 hover:bg-white/10 transition">
                      Library
                    </Link>
                    <Link to="/" className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-white font-semibold" style={{ background: 'linear-gradient(135deg,#1E6FD9,#4DA3FF)', boxShadow: '0 8px 20px rgba(30,111,217,0.35)' }}>
                      <Sparkles className="w-4 h-4" /> Create Lesson
                    </Link>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  )
}
