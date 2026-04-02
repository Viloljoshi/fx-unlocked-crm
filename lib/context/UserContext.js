'use client'

import { createContext, useContext, useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

const UserContext = createContext(null)

export function UserProvider({ children }) {
  const [user, setUser]       = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    let mounted = true

    const load = async () => {
      try {
        // getSession() reads from cookie — no network call to Supabase Auth server
        // Safe here because middleware already validated the session server-side
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.user || !mounted) { setLoading(false); return }

        const authUser = session.user
        setUser(authUser)

        // Single DB call for the profile
        const { data: profileData, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', authUser.id)
          .single()

        if (!mounted) return

        if (error && error.code === 'PGRST116') {
          // First-time user — create profile
          const { data: newProfile } = await supabase
            .from('profiles')
            .insert({
              id: authUser.id,
              email: authUser.email || '',
              first_name: authUser.user_metadata?.first_name || '',
              last_name: authUser.user_metadata?.last_name || '',
              role: authUser.user_metadata?.role || 'STAFF',
              is_active: true,
            })
            .select()
            .single()
          setProfile(newProfile)
        } else {
          setProfile(profileData)
        }
      } catch {
        // Silently fail — middleware handles redirect if truly unauthenticated
      } finally {
        if (mounted) setLoading(false)
      }
    }

    load()

    // Listen for auth state changes (sign out, token refresh) — no extra DB calls
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        setUser(null)
        setProfile(null)
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  const refetchProfile = async () => {
    if (!user) return
    const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    if (data) setProfile(data)
  }

  return (
    <UserContext.Provider value={{ user, profile, loading, refetchProfile }}>
      {children}
    </UserContext.Provider>
  )
}

export function useUser() {
  const ctx = useContext(UserContext)
  if (!ctx) throw new Error('useUser must be used inside UserProvider (dashboard layout)')
  return ctx
}
