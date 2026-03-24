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
import Logo from '@/components/ui/Logo'

export default function SetPasswordPage() {
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
    if (error) setErrorMsg(error)
  }, [])

  useEffect(() => {
    let cancelled = false
    const init = async () => {
      // Case 1: session already exchanged by /auth/callback
      const { data: { session } } = await supabase.auth.getSession()
      if (!cancelled && session) { finishCheck(true); return }

      // Case 2: code in URL (direct link, PKCE)
      const params = new URLSearchParams(window.location.search)
      const code = params.get('code')
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        if (!cancelled) {
          error
            ? finishCheck(false, 'This invite link is invalid or has expired. Please ask your admin to resend.')
            : finishCheck(true)
        }
        return
      }

      if (!cancelled) finishCheck(false, 'No valid invite link. Please ask your administrator to resend your invite.')
    }
    init()
    return () => { cancelled = true }
  }, [supabase, finishCheck])

  const handleSetPassword = async (e) => {
    e.preventDefault()
    if (password.length < 6) { toast.error('Password must be at least 6 characters'); return }
    if (password !== confirmPassword) { toast.error('Passwords do not match'); return }
    setLoading(true)
    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) { toast.error(error.message); return }
      setSuccess(true)
      toast.success('Password set! Welcome to FX Unlocked CRM 🎉')
      setTimeout(() => router.push('/dashboard'), 2000)
    } catch {
      toast.error('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#f0f4f8] flex flex-col items-center justify-center p-4">
      <div className="flex flex-col items-center mb-7">
        <div className="mb-3 drop-shadow-md"><Logo height={52} /></div>
        <p className="text-sm text-gray-500 mt-0.5">CRM &amp; Operations Platform</p>
      </div>

      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center space-y-4 pb-2">
          <div className="mx-auto w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-400 via-blue-500 to-purple-600 flex items-center justify-center shadow-md">
            {checking ? <Loader2 className="w-6 h-6 text-white animate-spin" />
              : success ? <CheckCircle2 className="w-6 h-6 text-white" />
              : <Lock className="w-6 h-6 text-white" />}
          </div>
          <div>
            <CardTitle className="text-2xl font-outfit font-bold">
              {checking ? 'Verifying invite…'
                : success ? 'All set! Welcome 🎉'
                : ready ? 'Set your password'
                : 'Link expired'}
            </CardTitle>
            <CardDescription className="mt-1">
              {checking ? 'Validating your invite link'
                : success ? 'Redirecting you to the dashboard…'
                : ready ? 'Choose a password to activate your account'
                : errorMsg || 'This invite link is invalid or has expired'}
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="pt-4">
          {checking && <div className="flex justify-center py-8"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>}

          {!checking && !ready && !success && (
            <div className="text-center py-4 space-y-3">
              <p className="text-sm text-muted-foreground">Ask your administrator to resend your invite.</p>
              <Button variant="outline" onClick={() => router.push('/login')} className="w-full">Back to Sign In</Button>
            </div>
          )}

          {success && (
            <div className="text-center py-6 space-y-2">
              <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-7 h-7 text-green-600" />
              </div>
              <p className="text-sm text-muted-foreground">Taking you to your dashboard now…</p>
            </div>
          )}

          {!checking && ready && !success && (
            <form onSubmit={handleSetPassword} className="space-y-4">
              <div className="space-y-2">
                <Label>Password</Label>
                <div className="relative">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Min. 6 characters"
                    required minLength={6} autoFocus
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Confirm Password</Label>
                <Input type="password" value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="Repeat your password" required />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Setting password…</> : 'Activate My Account'}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>

      <p className="mt-6 text-xs text-gray-400">© 2026 FX Unlocked. All rights reserved.</p>
    </div>
  )
}
