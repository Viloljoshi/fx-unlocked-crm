'use client'

import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import DealForm from '@/components/deals/DealForm'

export default function NewDealPage() {
  const router = useRouter()

  const handleSave = async (payload) => {
    const res = await fetch('/api/deals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    const data = await res.json()

    if (!res.ok) {
      throw new Error(data.error || 'Failed to create deal')
    }

    if (data.warning) {
      toast.warning(data.warning)
    } else {
      toast.success('Deal created successfully')
    }

    router.push(`/dashboard/deals/${data.deal.id}`)
  }

  return (
    <div className="p-6 max-w-[900px] mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.push('/dashboard/deals')}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Create New Deal</h1>
          <p className="text-sm text-muted-foreground">Configure affiliate deal, rebate structure, and terms</p>
        </div>
      </div>

      <DealForm
        mode="create"
        onSave={handleSave}
        onCancel={() => router.push('/dashboard/deals')}
      />
    </div>
  )
}
