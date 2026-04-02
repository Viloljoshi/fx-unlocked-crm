'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { Eye, EyeOff, CheckCircle2 } from 'lucide-react'
import Logo from '@/components/ui/Logo'

export default function SetPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [sessionReady, setSessionReady] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    // Supabase sets the session from the URL hash after the auth callback redirect
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) setSessionReady(true)
    })
    return () => subscription.unsubscribe()
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (password.length < 8) { toast.error('Password must be at least 8 characters'); return }
    if (password !== confirm) { toast.error('Passwords do not match'); return }
    setLoading(true)
    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error
      setDone(true)
      toast.success('Password set! Redirecting to your dashboard…')
      setTimeout(() => { window.location.href = '/dashboard' }, 2000)
    } catch (err) {
      toast.error(err.message || 'Something went wrong. Please try again.')
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

      <div className="w-full max-w-[400px] bg-white rounded-2xl border border-gray-200 shadow-sm px-8 py-8">
        {done ? (
          <div className="text-center space-y-4 py-4">
            <div className="w-14 h-14 bg-green-50 rounded-2xl flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-7 h-7 text-green-500" />
            </div>
            <div>
              <p className="font-semibold text-gray-900">Password set!</p>
              <p className="text-sm text-gray-500 mt-1">Redirecting you to the dashboard…</p>
            </div>
          </div>
        ) : (
          <>
            <div className="mb-6">
              <h2 className="text-[1.35rem] font-bold text-gray-900 tracking-tight">Set your password</h2>
              <p className="text-sm text-gray-500 mt-1">Choose a secure password to access your account</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-gray-700">New password</Label>
                <div className="relative">
                  <Input
                    type={showPw ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Min. 8 characters"
                    required
                    minLength={8}
                    className="h-10 rounded-xl border-gray-200 bg-gray-50 focus-visible:bg-white focus-visible:ring-2 focus-visible:ring-blue-500/25 focus-visible:border-blue-500 transition-colors pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(!showPw)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-gray-700">Confirm password</Label>
                <Input
                  type="password"
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  placeholder="Repeat your password"
                  required
                  minLength={8}
                  className="h-10 rounded-xl border-gray-200 bg-gray-50 focus-visible:bg-white focus-visible:ring-2 focus-visible:ring-blue-500/25 focus-visible:border-blue-500 transition-colors"
                />
              </div>

              <Button
                type="submit"
                disabled={loading || !sessionReady}
                className="w-full h-10 rounded-xl bg-gray-900 hover:bg-gray-800 text-white font-medium border-0 mt-1"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block" />
                    Setting password…
                  </span>
                ) : 'Set Password & Log In'}
              </Button>
            </form>
          </>
        )}
      </div>

      <p className="mt-6 text-xs text-gray-400">© 2026 FX Unlocked. All rights reserved.</p>
    </div>
  )
}
