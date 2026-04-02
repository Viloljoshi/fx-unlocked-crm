'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { ShieldCheck } from 'lucide-react'
import Logo from '@/components/ui/Logo'

export default function VerifyMfaPage() {
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  const verify = async () => {
    if (code.length !== 6) { toast.error('Enter the 6-digit code from your authenticator app'); return }
    setLoading(true)
    try {
      const { data: factors } = await supabase.auth.mfa.listFactors()
      const totpFactor = factors?.totp?.[0]
      if (!totpFactor) throw new Error('No MFA factor found — contact your administrator')

      const { data: challenge, error: chalErr } = await supabase.auth.mfa.challenge({ factorId: totpFactor.id })
      if (chalErr) throw chalErr

      const { error: verifyErr } = await supabase.auth.mfa.verify({
        factorId: totpFactor.id,
        challengeId: challenge.id,
        code,
      })
      if (verifyErr) throw verifyErr

      window.location.href = '/dashboard'
    } catch (err) {
      if (err.message?.toLowerCase().includes('invalid')) {
        toast.error('Incorrect code — check your authenticator app and try again')
      } else {
        toast.error(err.message || 'Verification failed')
      }
      setCode('')
    } finally {
      setLoading(false)
    }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  return (
    <div className="min-h-screen bg-[#f0f4f8] flex flex-col items-center justify-center p-4">
      <div className="flex flex-col items-center mb-7">
        <div className="mb-3 drop-shadow-md"><Logo height={52} /></div>
        <p className="text-sm text-gray-500 mt-0.5">CRM &amp; Operations Platform</p>
      </div>

      <div className="w-full max-w-[400px] bg-white rounded-2xl border border-gray-200 shadow-sm px-8 py-8">
        <div className="text-center mb-6">
          <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <ShieldCheck className="w-7 h-7 text-indigo-600" />
          </div>
          <h2 className="text-[1.35rem] font-bold text-gray-900 tracking-tight">Two-factor verification</h2>
          <p className="text-sm text-gray-500 mt-1">Enter the 6-digit code from your authenticator app</p>
        </div>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-gray-700">Authenticator code</Label>
            <Input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              value={code}
              onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              className="h-12 rounded-xl border-gray-200 bg-gray-50 text-center text-2xl font-mono tracking-[0.5em] focus-visible:bg-white focus-visible:ring-2 focus-visible:ring-indigo-500/25 focus-visible:border-indigo-500"
              onKeyDown={e => e.key === 'Enter' && verify()}
              autoFocus
            />
          </div>

          <Button
            onClick={verify}
            disabled={loading || code.length !== 6}
            className="w-full h-10 rounded-xl bg-gray-900 hover:bg-gray-800 text-white font-medium border-0"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block" />
                Verifying…
              </span>
            ) : 'Verify & Continue'}
          </Button>

          <button
            onClick={signOut}
            className="w-full text-sm text-gray-400 hover:text-gray-600 transition-colors text-center"
          >
            Sign in with a different account
          </button>
        </div>
      </div>

      <p className="mt-6 text-xs text-gray-400">© 2026 FX Unlocked. All rights reserved.</p>
    </div>
  )
}
