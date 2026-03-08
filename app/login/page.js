'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { TrendingUp, Eye, EyeOff, ArrowLeft, CheckCircle2, Users, Calendar, BarChart3, Shield } from 'lucide-react'

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
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
      toast.success('Welcome back!')
      window.location.href = '/dashboard'
    } catch (error) {
      toast.error(error.message || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  const handleForgotPassword = async (e) => {
    e.preventDefault()
    if (!email) { toast.error('Please enter your email address'); return }
    setLoading(true)
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      })
      if (error) throw error
      setResetSent(true)
    } catch (error) {
      toast.error(error.message || 'Failed to send reset email')
    } finally {
      setLoading(false)
    }
  }

  const features = [
    { icon: Users, label: 'Affiliate tracking & management' },
    { icon: Calendar, label: 'Appointment scheduling' },
    { icon: BarChart3, label: 'Commission analytics' },
    { icon: Shield, label: 'Role-based access control' },
  ]

  return (
    <div className="min-h-screen flex">
      {/* ── Left Brand Panel (desktop only) ── */}
      <div
        className="hidden lg:flex lg:w-[46%] relative overflow-hidden flex-col justify-between p-14"
        style={{ background: 'linear-gradient(145deg, #166534 0%, #15803d 35%, #6d28d9 100%)' }}
      >
        {/* Decorative blobs */}
        <div className="absolute -top-32 -right-32 w-[28rem] h-[28rem] rounded-full bg-white/5 pointer-events-none" />
        <div className="absolute -bottom-32 -left-32 w-[28rem] h-[28rem] rounded-full bg-white/5 pointer-events-none" />
        <div className="absolute top-1/2 right-0 w-56 h-56 rounded-full bg-white/[0.04] -translate-y-1/2 translate-x-1/3 pointer-events-none" />

        {/* Logo */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="w-11 h-11 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center border border-white/25 shadow-lg">
            <TrendingUp className="w-5 h-5 text-white" />
          </div>
          <span className="text-white font-bold text-xl tracking-tight">FX Unlocked</span>
        </div>

        {/* Hero text + features */}
        <div className="relative z-10 space-y-10">
          <div className="space-y-4">
            <h1 className="text-[2.6rem] font-bold text-white leading-tight">
              The CRM built<br />for FX professionals
            </h1>
            <p className="text-white/60 text-base leading-relaxed max-w-xs">
              Streamline operations, grow your affiliate network, and manage every client relationship in one platform.
            </p>
          </div>

          <div className="space-y-3.5">
            {features.map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-3.5">
                <div className="w-8 h-8 bg-white/15 rounded-xl flex items-center justify-center flex-shrink-0 border border-white/10">
                  <Icon className="w-3.5 h-3.5 text-white/90" />
                </div>
                <span className="text-white/70 text-sm">{label}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="relative z-10 text-white/25 text-xs">© 2025 FX Unlocked. All rights reserved.</p>
      </div>

      {/* ── Right Form Panel ── */}
      <div className="flex-1 flex items-center justify-center bg-white p-8">
        <div className="w-full max-w-[22rem]">

          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2.5 mb-10">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center shadow-sm"
              style={{ background: 'linear-gradient(135deg, #16a34a, #7c3aed)' }}>
              <TrendingUp className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-lg tracking-tight">FX Unlocked</span>
          </div>

          {/* ── FORGOT PASSWORD ── */}
          {mode === 'forgot' && (
            <div className="space-y-7">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Reset password</h2>
                <p className="mt-1.5 text-sm text-gray-500">We&apos;ll send a secure link to your email</p>
              </div>

              {resetSent ? (
                <div className="text-center py-6 space-y-5">
                  <div className="w-16 h-16 bg-green-50 rounded-2xl flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-8 h-8 text-green-500" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">Check your inbox</p>
                    <p className="text-sm text-gray-500 mt-1.5">
                      We sent a reset link to<br />
                      <strong className="text-gray-700">{email}</strong>
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
                <form onSubmit={handleForgotPassword} className="space-y-5">
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium text-gray-700">Email address</Label>
                    <Input
                      type="email" value={email} onChange={e => setEmail(e.target.value)}
                      placeholder="you@company.com" required
                      className="h-11 border-gray-200 rounded-xl focus-visible:ring-2 focus-visible:ring-green-500/25 focus-visible:border-green-500"
                    />
                  </div>
                  <Button
                    type="submit" disabled={loading}
                    className="w-full h-11 rounded-xl font-medium text-white border-0 shadow-sm shadow-green-600/20"
                    style={{ background: 'linear-gradient(135deg, #16a34a, #15803d)' }}
                  >
                    {loading ? 'Sending...' : 'Send reset link'}
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
            <div className="space-y-7">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Welcome back</h2>
                <p className="mt-1.5 text-sm text-gray-500">Sign in to your FX Unlocked account</p>
              </div>

              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-sm font-medium text-gray-700">Email address</Label>
                  <Input
                    id="email" type="email" value={email} onChange={e => setEmail(e.target.value)}
                    placeholder="you@company.com" required autoComplete="email"
                    className="h-11 border-gray-200 rounded-xl focus-visible:ring-2 focus-visible:ring-green-500/25 focus-visible:border-green-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password" className="text-sm font-medium text-gray-700">Password</Label>
                    <button
                      type="button" onClick={() => setMode('forgot')}
                      className="text-xs font-medium text-green-600 hover:text-green-700 transition-colors"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <div className="relative">
                    <Input
                      id="password" type={showPassword ? 'text' : 'password'}
                      value={password} onChange={e => setPassword(e.target.value)}
                      placeholder="Enter your password" required minLength={6} autoComplete="current-password"
                      className="h-11 border-gray-200 rounded-xl focus-visible:ring-2 focus-visible:ring-green-500/25 focus-visible:border-green-500 pr-11"
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
                  className="w-full h-11 rounded-xl font-medium text-white border-0 shadow-sm shadow-green-600/20 mt-1"
                  style={{ background: loading ? '#16a34a88' : 'linear-gradient(135deg, #16a34a, #15803d)' }}
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block" />
                      Signing in…
                    </span>
                  ) : 'Sign in'}
                </Button>
              </form>

              <p className="text-center text-xs text-gray-400">
                Need access? Contact your administrator.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
