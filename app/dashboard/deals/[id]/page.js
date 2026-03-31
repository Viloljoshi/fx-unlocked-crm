'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { ArrowLeft, Send, Edit3 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { toast } from 'sonner'
import DealSummary from '@/components/deals/DealSummary'
import DealStatusBadge from '@/components/deals/DealStatusBadge'
import RebateStructure from '@/components/deals/RebateStructure'
import DealNotes from '@/components/deals/DealNotes'
import DealHistory from '@/components/deals/DealHistory'
import DealForm from '@/components/deals/DealForm'
import { createClient } from '@/lib/supabase/client'

export default function DealDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const supabase = createClient()

  const [deal, setDeal] = useState(null)
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [editing, setEditing] = useState(false)
  const [affiliates, setAffiliates] = useState([])

  useEffect(() => {
    if (id) {
      fetchDeal()
      fetchAffiliates()
    }
  }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchDeal(showLoader = true) {
    if (showLoader) setLoading(true)
    try {
      const res = await fetch(`/api/deals/${id}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load deal')
      setDeal(data.deal)
    } catch (err) {
      console.error('Error fetching deal:', err)
      toast.error(err.message || 'Failed to load deal')
    } finally {
      if (showLoader) setLoading(false)
    }
  }

  async function fetchAffiliates() {
    const { data } = await supabase.from('affiliates').select('id, name, email').order('name')
    setAffiliates(data || [])
  }

  async function handleSendDeal() {
    setSending(true)
    try {
      const res = await fetch(`/api/deals/${id}/send`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to send deal')
      toast.success(data.message || 'Deal sent for approval')
      fetchDeal(false)
    } catch (err) {
      toast.error(err.message || 'Failed to send deal')
    } finally {
      setSending(false)
    }
  }

  async function handleUpdate(payload) {
    const res = await fetch(`/api/deals/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Failed to update deal')
    toast.success('Deal updated successfully')
    setEditing(false)
    fetchDeal(false)
  }

  function handleNoteAdded(note) {
    setDeal((prev) => prev ? ({
      ...prev,
      deal_notes: [note, ...(prev.deal_notes || [])],
    }) : prev)
  }

  if (loading) {
    return (
      <div className="p-6 max-w-[1000px] mx-auto space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (!deal) {
    return (
      <div className="p-6 text-center py-20">
        <h2 className="text-xl font-semibold">Deal not found</h2>
        <Button className="mt-4" onClick={() => router.push('/dashboard/deals')}>
          Back to Deals
        </Button>
      </div>
    )
  }

  if (editing) {
    return (
      <div className="p-6 max-w-[900px] mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setEditing(false)}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <h1 className="text-2xl font-bold">Edit Deal</h1>
        </div>
        <DealForm
          deal={deal}
          mode="edit"
          onSave={handleUpdate}
          onCancel={() => setEditing(false)}
        />
      </div>
    )
  }

  return (
    <div className="p-6 max-w-[1000px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.push('/dashboard/deals')}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight">
                {deal.affiliate?.name || 'Deal'}
              </h1>
              <DealStatusBadge status={deal.status} />
            </div>
            <p className="text-sm text-muted-foreground">{deal.deal_type} Deal — {deal.broker?.name || 'No broker'}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {['DRAFT', 'PENDING'].includes(deal.status) && (
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
              <Edit3 className="w-3.5 h-3.5 mr-1.5" /> Edit
            </Button>
          )}
          {deal.status === 'DRAFT' && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="sm" disabled={sending}>
                  <Send className="w-3.5 h-3.5 mr-1.5" />
                  {sending ? 'Sending...' : 'Send Deal'}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Send Deal for Approval?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will change the deal status to Pending and send an approval email to the account manager.
                    The email will include a secure approval link valid for 72 hours.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleSendDeal}>
                    Send for Approval
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="details">
        <TabsList>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="rebates">Rebate Structure</TabsTrigger>
          <TabsTrigger value="notes">Notes ({deal.deal_notes?.length || 0})</TabsTrigger>
          <TabsTrigger value="history">History ({deal.deal_versions?.length || 0})</TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Deal Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <DealSummary deal={deal} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rebates" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Rebate Hierarchy</CardTitle>
            </CardHeader>
            <CardContent>
              <RebateStructure
                levels={deal.deal_levels || []}
                affiliates={affiliates}
                readOnly
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notes" className="mt-4">
          <Card>
            <CardContent className="pt-6">
              <DealNotes
                dealId={deal.id}
                notes={deal.deal_notes || []}
                onNoteAdded={handleNoteAdded}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <Card>
            <CardContent className="pt-6">
              <DealHistory versions={deal.deal_versions || []} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
