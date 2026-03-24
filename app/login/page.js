'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { Eye, EyeOff, ArrowLeft, CheckCircle2 } from 'lucide-react'
import Logo from '@/components/ui/Logo'

export default function LoginPage() {
  const [mode, setMode] = useState('login') // 'login' | 'forgot'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [resetSent, setResetSent] = useState(false)
  const supabase = createClient()

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        const msg = error.message || ''
        if (msg.includes('Invalid login credentials') || msg.includes('invalid_credentials')) {
          toast.error('Incorrect email or password. Please try again.')
        } else if (msg.includes('Email not confirmed')) {
          toast.error('Account not yet activated. Contact your administrator.')
        } else if (msg.includes('rate limit') || msg.includes('too many')) {
          toast.error('Too many attempts. Please wait a few minutes and try again.')
        } else {
          toast.error(msg || 'Sign in failed. Please try again.')
        }
        return
      }

      // Edge case: check if account is deactivated
      const { data: profile } = await supabase
        .from('profiles')
        .select('is_active')
        .eq('id', data.user.id)
        .single()

      if (profile && profile.is_active === false) {
        await supabase.auth.signOut()
        toast.error('Your account has been deactivated. Please contact your administrator.')
        return
      }

      toast.success('Welcome back!')
      window.location.href = '/dashboard'
    } catch {
      toast.error('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleForgotPassword = async (e) => {
    e.preventDefault()
    if (!email) { toast.error('Please enter your email address'); return }
    setLoading(true)
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      if (!res.ok) {
        const data = await res.json()
        // Only show rate limit errors — not "user not found" (prevent enumeration)
        if (data.error?.includes('rate') || data.error?.includes('too many')) {
          toast.error('Too many requests. Please wait a few minutes.')
          return
        }
      }
      // Always show success
      setResetSent(true)
    } catch {
      toast.error('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#f0f4f8] flex flex-col items-center justify-center p-4">

      {/* Brand mark above card */}
      <div className="flex flex-col items-center mb-7">
        <div className="mb-3 drop-shadow-md">
          <Logo height={52} />
        </div>
        <p className="text-sm text-gray-500 mt-0.5">CRM &amp; Operations Platform</p>
      </div>

      {/* Card */}
      <div className="w-full max-w-[400px] bg-white rounded-2xl border border-gray-200 shadow-sm px-8 py-8">

        {/* ── FORGOT PASSWORD ── */}
        {mode === 'forgot' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-[1.35rem] font-bold text-gray-900 tracking-tight">Reset your password</h2>
              <p className="text-sm text-gray-500 mt-1">Enter your email and we&apos;ll send a reset link</p>
            </div>

            {resetSent ? (
              <div className="text-center py-4 space-y-4">
                <div className="w-14 h-14 bg-green-50 rounded-2xl flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-7 h-7 text-green-500" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900">Check your inbox</p>
                  <p className="text-sm text-gray-500 mt-1">
                    If <strong className="text-gray-700">{email}</strong> is registered, you&apos;ll receive a reset link shortly.
                  </p>
                </div>
                <button
                  onClick={() => { setMode('login'); setResetSent(false) }}
                  className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 mx-auto transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5" /> Back to sign in
                </button>
              </div>
            ) : (
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium text-gray-700">Email address</Label>
                  <Input
                    type="email" value={email} onChange={e => setEmail(e.target.value)}
                    placeholder="you@company.com" required
                    className="h-10 rounded-xl border-gray-200 bg-gray-50 focus-visible:bg-white focus-visible:ring-2 focus-visible:ring-blue-500/25 focus-visible:border-blue-500 transition-colors"
                  />
                </div>
                <Button
                  type="submit" disabled={loading}
                  className="w-full h-10 rounded-xl bg-gray-900 hover:bg-gray-800 text-white font-medium border-0"
                >
                  {loading ? 'Sending…' : 'Send reset link'}
                </Button>
                <button
                  type="button" onClick={() => setMode('login')}
                  className="w-full flex items-center justify-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5" /> Back to sign in
                </button>
              </form>
            )}
          </div>
        )}

        {/* ── LOGIN ── */}
        {mode === 'login' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-[1.35rem] font-bold text-gray-900 tracking-tight">Welcome back</h2>
              <p className="text-sm text-gray-500 mt-1">Sign in to your account to continue</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-sm font-medium text-gray-700">Email address</Label>
                <Input
                  id="email" type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="you@company.com" required autoComplete="email"
                  className="h-10 rounded-xl border-gray-200 bg-gray-50 focus-visible:bg-white focus-visible:ring-2 focus-visible:ring-blue-500/25 focus-visible:border-blue-500 transition-colors"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-sm font-medium text-gray-700">Password</Label>
                  <button
                    type="button" onClick={() => { setMode('forgot') }}
                    className="text-xs font-medium text-blue-600 hover:text-blue-700 transition-colors"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <Input
                    id="password" type={showPassword ? 'text' : 'password'}
                    value={password} onChange={e => setPassword(e.target.value)}
                    placeholder="Enter your password" required minLength={6} autoComplete="current-password"
                    className="h-10 rounded-xl border-gray-200 bg-gray-50 focus-visible:bg-white focus-visible:ring-2 focus-visible:ring-blue-500/25 focus-visible:border-blue-500 transition-colors pr-10"
                  />
                  <button
                    type="button" onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit" disabled={loading}
                className="w-full h-10 rounded-xl bg-gray-900 hover:bg-gray-800 text-white font-medium border-0 mt-1"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block" />
                    Signing in…
                  </span>
                ) : 'Sign in'}
              </Button>
            </form>

            <p className="text-center text-xs text-gray-400 border-t border-gray-100 pt-5">
              Need access?{' '}
              <span className="text-gray-500">Contact your administrator.</span>
            </p>
          </div>
        )}
      </div>

      <p className="mt-6 text-xs text-gray-400">© 2026 FX Unlocked. All rights reserved.</p>
    </div>
  )
}
