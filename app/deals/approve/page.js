'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { CheckCircle2, XCircle, Clock, Loader2, Ban } from 'lucide-react'

function ApproveContent() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token')
  const action = searchParams.get('action') // null = approve, 'reject' = reject

  const [status, setStatus] = useState('loading')
  const [message, setMessage] = useState('')
  const [dealInfo, setDealInfo] = useState(null)

  const isReject = action === 'reject'

  useEffect(() => {
    if (!token) {
      setStatus('error')
      setMessage('No token provided.')
      return
    }

    const timeout = setTimeout(() => {
      setStatus((prev) => {
        if (prev === 'loading') return 'error'
        return prev
      })
      setMessage((prev) => prev || 'Request timed out. Please try again.')
    }, 15000)

    processToken()
    return () => clearTimeout(timeout)
  }, [token, action]) // eslint-disable-line react-hooks/exhaustive-deps

  async function processToken() {
    try {
      const endpoint = isReject ? '/api/deals/reject' : '/api/deals/approve'
      const res = await fetch(`${endpoint}?token=${encodeURIComponent(token)}`)
      const data = await res.json()

      if (res.ok) {
        setStatus(isReject ? 'rejected' : 'success')
        setMessage(isReject
          ? 'Deal has been rejected.'
          : 'Deal has been approved and activated successfully.'
        )
        setDealInfo(data)
      } else {
        switch (data.code) {
          case 'ALREADY_APPROVED':
          case 'ALREADY_USED':
            setStatus('already_used')
            setMessage('This link has already been used.')
            break
          case 'TOKEN_EXPIRED':
            setStatus('expired')
            setMessage('This link has expired. Please request a new approval email.')
            break
          case 'INVALID_TOKEN':
            setStatus('error')
            setMessage('Invalid or tampered link.')
            break
          default:
            setStatus('error')
            setMessage(data.error || 'Something went wrong.')
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
    rejected: <Ban className="w-16 h-16 text-red-500" />,
    already_used: <CheckCircle2 className="w-16 h-16 text-gray-400" />,
    expired: <Clock className="w-16 h-16 text-yellow-500" />,
    error: <XCircle className="w-16 h-16 text-red-500" />,
  }

  const titles = {
    loading: isReject ? 'Processing Rejection...' : 'Processing Approval...',
    success: 'Deal Approved!',
    rejected: 'Deal Rejected',
    already_used: 'Already Processed',
    expired: 'Link Expired',
    error: 'Action Failed',
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 p-4">
      <div className="max-w-md w-full bg-white dark:bg-gray-900 rounded-xl shadow-lg p-8 text-center space-y-6">
        <div className="flex justify-center">{icons[status]}</div>
        <h1 className="text-2xl font-bold">{titles[status]}</h1>
        <p className="text-gray-500">{message}</p>

        {dealInfo?.affiliate_name && (
          <p className="text-sm font-medium">Affiliate: {dealInfo.affiliate_name}</p>
        )}

        <div className="pt-4">
          <p className="text-xs text-gray-400">FX Unlocked CRM</p>
        </div>
      </div>
    </div>
  )
}

export default function ApprovePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    }>
      <ApproveContent />
    </Suspense>
  )
}
