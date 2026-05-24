import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '@/integrations/supabase/client'

export type UserRole = 'teacher' | 'student'

export interface Profile {
  id: string
  display_name: string
  role: UserRole
  grade: string | null
}

interface AuthCtx {
  user: User | null
  session: Session | null
  profile: Profile | null
  loading: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthCtx>({ user: null, session: null, profile: null, loading: true, signOut: async () => {} })

async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id,display_name,role,grade')
    .eq('id', userId)
    .maybeSingle()

  if (error) {
    console.error('Failed to load profile:', error)
    return null
  }

  return data as Profile | null
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true

    const applySession = async (nextSession: Session | null) => {
      setLoading(true)
      const nextUser = nextSession?.user ?? null
      const nextProfile = nextUser ? await fetchProfile(nextUser.id) : null
      if (!active) return
      setSession(nextSession)
      setUser(nextUser)
      setProfile(nextProfile)
      setLoading(false)
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      void applySession(s)
    })
    supabase.auth.getSession().then(({ data: { session } }) => {
      void applySession(session)
    })
    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  const signOut = async () => { await supabase.auth.signOut() }

  return <AuthContext.Provider value={{ user, session, profile, loading, signOut }}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)
