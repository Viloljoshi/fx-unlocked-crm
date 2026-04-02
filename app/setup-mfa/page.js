'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { ShieldCheck, Smartphone, CheckCircle2, ChevronRight } from 'lucide-react'
import Logo from '@/components/ui/Logo'
import Image from 'next/image'

export default function SetupMfaPage() {
  const [step, setStep] = useState('intro') // intro | scan | verify | done
  const [qrCode, setQrCode] = useState('')
  const [secret, setSecret] = useState('')
  const [factorId, setFactorId] = useState('')
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  const startEnroll = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        issuer: 'FX Unlocked CRM',
      })
      if (error) throw error
      setQrCode(data.totp.qr_code)
      setSecret(data.totp.secret)
      setFactorId(data.id)
      setStep('scan')
    } catch (err) {
      toast.error(err.message || 'Failed to generate QR code')
    } finally {
      setLoading(false)
    }
  }

  const verifyCode = async () => {
    if (code.length !== 6) { toast.error('Enter the 6-digit code from your authenticator app'); return }
    setLoading(true)
    try {
      const { data: challenge, error: chalErr } = await supabase.auth.mfa.challenge({ factorId })
      if (chalErr) throw chalErr

      const { error: verifyErr } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challenge.id,
        code,
      })
      if (verifyErr) throw verifyErr

      setStep('done')
    } catch (err) {
      if (err.message?.includes('Invalid') || err.message?.includes('invalid')) {
        toast.error('Incorrect code — check your authenticator app and try again')
      } else {
        toast.error(err.message || 'Verification failed')
      }
      setCode('')
    } finally {
      setLoading(false)
    }
  }

  const skipForNow = () => {
    window.location.href = '/dashboard'
  }

  const goToDashboard = () => {
    window.location.href = '/dashboard'
  }

  return (
    <div className="min-h-screen bg-[#f0f4f8] flex flex-col items-center justify-center p-4">
      <div className="flex flex-col items-center mb-7">
        <div className="mb-3 drop-shadow-md"><Logo height={52} /></div>
        <p className="text-sm text-gray-500 mt-0.5">CRM &amp; Operations Platform</p>
      </div>

      <div className="w-full max-w-[420px] bg-white rounded-2xl border border-gray-200 shadow-sm px-8 py-8">

        {/* Step: Intro */}
        {step === 'intro' && (
          <div className="space-y-6">
            <div className="text-center">
              <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <ShieldCheck className="w-7 h-7 text-indigo-600" />
              </div>
              <h2 className="text-[1.35rem] font-bold text-gray-900 tracking-tight">Secure your account</h2>
              <p className="text-sm text-gray-500 mt-2">
                Set up two-factor authentication to protect your FX Unlocked CRM account.
              </p>
            </div>

            <div className="space-y-3">
              {[
                { icon: Smartphone, text: 'Download Google Authenticator or Authy on your phone' },
                { icon: ShieldCheck, text: 'Scan the QR code we\'ll show you' },
                { icon: CheckCircle2, text: 'Enter the 6-digit code to confirm setup' },
              ].map(({ icon: Icon, text }, i) => (
                <div key={i} className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl">
                  <div className="w-7 h-7 bg-indigo-100 rounded-lg flex items-center justify-center shrink-0 mt-0.5">
                    <Icon className="w-4 h-4 text-indigo-600" />
                  </div>
                  <p className="text-sm text-gray-600">{text}</p>
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <Button onClick={startEnroll} disabled={loading} className="w-full h-10 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-medium border-0">
                {loading ? 'Generating QR code…' : (
                  <span className="flex items-center gap-2">Set Up MFA <ChevronRight className="w-4 h-4" /></span>
                )}
              </Button>
              <Button variant="ghost" onClick={skipForNow} className="w-full h-10 rounded-xl text-gray-400 hover:text-gray-600 text-sm">
                Remind me later
              </Button>
            </div>
          </div>
        )}

        {/* Step: Scan QR */}
        {step === 'scan' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-[1.35rem] font-bold text-gray-900 tracking-tight">Scan QR code</h2>
              <p className="text-sm text-gray-500 mt-1">Open your authenticator app and scan this code</p>
            </div>

            <div className="flex justify-center">
              <div className="p-3 bg-white border-2 border-gray-200 rounded-2xl">
                {qrCode && (
                  <img src={qrCode} alt="MFA QR Code" width={180} height={180} className="rounded-lg" />
                )}
              </div>
            </div>

            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-xs text-gray-500 text-center mb-1.5">Can&apos;t scan? Enter this code manually:</p>
              <p className="text-xs font-mono text-gray-700 text-center break-all select-all">{secret}</p>
            </div>

            <Button onClick={() => setStep('verify')} className="w-full h-10 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-medium border-0">
              I&apos;ve scanned it <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        )}

        {/* Step: Verify */}
        {step === 'verify' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-[1.35rem] font-bold text-gray-900 tracking-tight">Enter verification code</h2>
              <p className="text-sm text-gray-500 mt-1">Enter the 6-digit code shown in your authenticator app</p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-gray-700">6-digit code</Label>
              <Input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={code}
                onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                className="h-12 rounded-xl border-gray-200 bg-gray-50 text-center text-2xl font-mono tracking-[0.5em] focus-visible:bg-white focus-visible:ring-2 focus-visible:ring-indigo-500/25 focus-visible:border-indigo-500"
                onKeyDown={e => e.key === 'Enter' && verifyCode()}
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Button onClick={verifyCode} disabled={loading || code.length !== 6} className="w-full h-10 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-medium border-0">
                {loading ? 'Verifying…' : 'Verify & Enable MFA'}
              </Button>
              <Button variant="ghost" onClick={() => setStep('scan')} className="w-full h-10 rounded-xl text-gray-400 hover:text-gray-600 text-sm">
                Back to QR code
              </Button>
            </div>
          </div>
        )}

        {/* Step: Done */}
        {step === 'done' && (
          <div className="text-center space-y-5 py-2">
            <div className="w-16 h-16 bg-green-50 rounded-2xl flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8 text-green-500" />
            </div>
            <div>
              <h2 className="text-[1.35rem] font-bold text-gray-900 tracking-tight">MFA enabled!</h2>
              <p className="text-sm text-gray-500 mt-2">
                Your account is now protected with two-factor authentication.
                You&apos;ll be asked for a code each time you log in.
              </p>
            </div>
            <Button onClick={goToDashboard} className="w-full h-10 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-medium border-0">
              Go to Dashboard
            </Button>
          </div>
        )}
      </div>

      <p className="mt-6 text-xs text-gray-400">© 2026 FX Unlocked. All rights reserved.</p>
    </div>
  )
}
