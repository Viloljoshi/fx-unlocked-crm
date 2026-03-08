'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

/**
 * Returns the current user's role, id, and profile.
 * Cached in component state — fetches once on mount.
 */
export function useUserRole() {
  const [userId, setUserId] = useState(null)
  const [role, setRole] = useState(null)    // 'ADMIN' | 'STAFF' | 'VIEWER'
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    const load = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { setLoading(false); return }
        setUserId(user.id)

        const { data } = await supabase
          .from('profiles')
          .select('role, first_name, last_name')
          .eq('id', user.id)
          .single()

        setRole(data?.role || 'STAFF')
        setProfile(data)
      } catch {
        setRole('STAFF')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  return { userId, role, profile, loading, isAdmin: role === 'ADMIN' }
}
