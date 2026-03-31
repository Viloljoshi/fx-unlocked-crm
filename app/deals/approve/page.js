'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { CheckCircle2, XCircle, Clock, Loader2 } from 'lucide-react'

function ApproveContent() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token')

  const [status, setStatus] = useState('loading') // loading | success | error | expired | already_approved
  const [message, setMessage] = useState('')
  const [dealInfo, setDealInfo] = useState(null)

  useEffect(() => {
    if (!token) {
      setStatus('error')
      setMessage('No approval token provided.')
      return
    }
    approveToken()
  }, [token]) // eslint-disable-line react-hooks/exhaustive-deps

  async function approveToken() {
    try {
      const res = await fetch(`/api/deals/approve?token=${token}`)
      const data = await res.json()

      if (res.ok) {
        setStatus('success')
        setMessage('Deal has been approved and activated successfully.')
        setDealInfo(data)
      } else {
        switch (data.code) {
          case 'ALREADY_APPROVED':
            setStatus('already_approved')
            setMessage('This deal has already been approved.')
            break
          case 'TOKEN_EXPIRED':
            setStatus('expired')
            setMessage('This approval link has expired. Please request a new approval email.')
            break
          default:
            setStatus('error')
            setMessage(data.error || 'Failed to approve deal.')
        }
      }
    } catch (err) {
      setStatus('error')
      setMessage('An unexpected error occurred. Please try again.')
    }
  }

  const icons = {
    loading: <Loader2 className="w-16 h-16 text-blue-500 animate-spin" />,
    success: <CheckCircle2 className="w-16 h-16 text-green-500" />,
    already_approved: <CheckCircle2 className="w-16 h-16 text-green-500" />,
    expired: <Clock className="w-16 h-16 text-yellow-500" />,
    error: <XCircle className="w-16 h-16 text-red-500" />,
  }

  const titles = {
    loading: 'Processing Approval...',
    success: 'Deal Approved!',
    already_approved: 'Already Approved',
    expired: 'Link Expired',
    error: 'Approval Failed',
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 p-4">
      <div className="max-w-md w-full bg-white dark:bg-gray-900 rounded-xl shadow-lg p-8 text-center space-y-6">
        <div className="flex justify-center">{icons[status]}</div>
        <h1 className="text-2xl font-bold">{titles[status]}</h1>
        <p className="text-muted-foreground">{message}</p>

        {dealInfo?.affiliate_name && (
          <p className="text-sm font-medium">Affiliate: {dealInfo.affiliate_name}</p>
        )}

        <div className="pt-4">
          <p className="text-xs text-muted-foreground">FX Unlocked CRM</p>
        </div>
      </div>
    </div>
  )
}

export default function ApprovePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    }>
      <ApproveContent />
    </Suspense>
  )
}
