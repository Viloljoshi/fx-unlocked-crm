'use client'

import { useUser } from '@/lib/context/UserContext'

/**
 * Returns the current user's role, id, and profile.
 * Reads from UserContext — NO additional auth or DB calls.
 * All data is fetched once in the dashboard layout's UserProvider.
 */
export function useUserRole() {
  const { user, profile, loading } = useUser()

  return {
    userId:  user?.id ?? null,
    role:    profile?.role ?? 'STAFF',
    profile: profile ?? null,
    loading,
    isAdmin: profile?.role === 'ADMIN',
  }
}
