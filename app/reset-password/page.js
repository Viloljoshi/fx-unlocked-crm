'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { toast } from 'sonner'
import { Lock, Eye, EyeOff, Loader2, CheckCircle2 } from 'lucide-react'

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [ready, setReady] = useState(false)
  const [checking, setChecking] = useState(true)
  const [success, setSuccess] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const router = useRouter()
  const supabase = createClient()

  const finishCheck = useCallback((isReady, error) => {
    setReady(isReady)
    setChecking(false)
    if (error) {
      setErrorMsg(error)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    let timeoutId = null

    const init = async () => {
      try {
        // ---- Case 1: Auth callback already exchanged the code, session exists ----
        const { data: { session } } = await supabase.auth.getSession()
        if (!cancelled && session) {
          finishCheck(true)
          return
        }

        // ---- Case 2: PKCE flow — ?code= in query params (direct redirect, not through callback) ----
        const params = new URLSearchParams(window.location.search)
        const code = params.get('code')
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code)
          if (!cancelled) {
            if (error) {
              console.error('Code exchange error:', error.message)
              finishCheck(false, 'This reset link is invalid or has expired. Please request a new one.')
            } else {
              finishCheck(true)
            }
          }
          return
        }

        // ---- Case 3: Implicit flow — #access_token= in hash fragment ----
        const hash = window.location.hash
        if (hash && hash.includes('access_token')) {
          // The Supabase client auto-parses hash fragments on init.
          // Give it a moment to process and fire the event.
          const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if (!cancelled && (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') && session) {
              finishCheck(true)
              subscription.unsubscribe()
              if (timeoutId) clearTimeout(timeoutId)
            }
          })

          // Also re-check session after a brief delay
          timeoutId = setTimeout(async () => {
            if (cancelled) return
            const { data: { session: s2 } } = await supabase.auth.getSession()
            if (s2) {
              finishCheck(true)
            } else {
              finishCheck(false, 'This reset link is invalid or has expired.')
            }
            subscription.unsubscribe()
          }, 4000)
          return
        }

        // ---- Case 4: No code, no hash, no session — invalid access ----
        if (!cancelled) {
          finishCheck(false, 'No valid reset link detected. Please request a new password reset from the login page.')
        }
      } catch (err) {
        console.error('Reset password init error:', err)
        if (!cancelled) {
          finishCheck(false, 'Something went wrong. Please try again.')
        }
      }
    }

    init()

    return () => {
      cancelled = true
      if (timeoutId) clearTimeout(timeoutId)
    }
  }, [supabase, finishCheck])

  const handleReset = async (e) => {
    e.preventDefault()
    if (password.length < 6) {
      toast.error('Password must be at least 6 characters')
      return
    }
    if (password !== confirmPassword) {
      toast.error('Passwords do not match')
      return
    }

    setLoading(true)
    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) {
        toast.error(error.message)
        setLoading(false)
        return
      }
      setSuccess(true)
      toast.success('Password updated successfully!')
      await supabase.auth.signOut()
      setTimeout(() => router.push('/login'), 2500)
    } catch (err) {
      toast.error('An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-green-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-500/8 rounded-full blur-3xl" />
      </div>

      <Card className="w-full max-w-md relative shadow-lg">
        <CardHeader className="text-center space-y-4 pb-2">
          <div className="mx-auto w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-purple-600 flex items-center justify-center shadow-md">
            {checking ? (
              <Loader2 className="w-6 h-6 text-white animate-spin" />
            ) : success ? (
              <CheckCircle2 className="w-6 h-6 text-white" />
            ) : (
              <Lock className="w-6 h-6 text-white" />
            )}
          </div>
          <div>
            <CardTitle className="text-2xl font-outfit font-bold">
              {checking ? 'Verifying...' : success ? 'Password Updated!' : ready ? 'Set New Password' : 'Link Expired'}
            </CardTitle>
            <CardDescription className="mt-1">
              {checking
                ? 'Validating your reset link'
                : success
                ? 'Redirecting you to sign in...'
                : ready
                ? 'Choose a strong password for your account'
                : errorMsg || 'This reset link is invalid or expired'}
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="pt-4">
          {/* Loading state */}
          {checking && (
            <div className="flex justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          )}

          {/* Error / expired state */}
          {!checking && !ready && !success && (
            <div className="text-center py-4">
              <Button variant="outline" onClick={() => router.push('/login')} className="w-full">
                Back to Sign In
              </Button>
            </div>
          )}

          {/* Success state */}
          {success && (
            <div className="text-center py-4">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <CheckCircle2 className="w-6 h-6 text-green-600" />
              </div>
              <p className="text-sm text-muted-foreground">You&apos;ll be redirected to the login page shortly.</p>
            </div>
          )}

          {/* Password form */}
          {!checking && ready && !success && (
            <form onSubmit={handleReset} className="space-y-4">
              <div className="space-y-2">
                <Label>New Password</Label>
                <div className="relative">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Min. 6 characters"
                    required
                    minLength={6}
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Confirm Password</Label>
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="Repeat your new password"
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Updating...</>
                ) : (
                  'Set New Password'
                )}
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                You&apos;ll be signed out after resetting and redirected to login.
              </p>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
