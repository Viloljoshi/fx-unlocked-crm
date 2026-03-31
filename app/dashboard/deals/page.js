'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Plus, Search, Handshake } from 'lucide-react'
import DealStatusBadge from '@/components/deals/DealStatusBadge'

export default function DealsPage() {
  const router = useRouter()
  const supabase = createClient()

  const [deals, setDeals] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [dealTypeFilter, setDealTypeFilter] = useState('ALL')

  useEffect(() => {
    fetchDeals()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchDeals() {
    setLoading(true)
    try {
      let query = supabase
        .from('deals')
        .select(`
          *,
          affiliate:affiliates(id, name, email),
          broker:brokers(id, name)
        `)
        .order('created_at', { ascending: false })

      const { data, error } = await query
      if (error) throw error
      setDeals(data || [])
    } catch (err) {
      console.error('Error fetching deals:', err)
      toast.error('Failed to load deals')
    } finally {
      setLoading(false)
    }
  }

  // Client-side filtering
  const filtered = deals.filter((d) => {
    if (statusFilter !== 'ALL' && d.status !== statusFilter) return false
    if (dealTypeFilter !== 'ALL' && d.deal_type !== dealTypeFilter) return false
    if (search) {
      const q = search.toLowerCase()
      return (
        d.affiliate?.name?.toLowerCase().includes(q) ||
        d.affiliate?.email?.toLowerCase().includes(q) ||
        d.broker?.name?.toLowerCase().includes(q) ||
        d.deal_type?.toLowerCase().includes(q)
      )
    }
    return true
  })

  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Handshake className="w-6 h-6" /> Deals
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Manage IB / Affiliate deals, rebate structures, and approvals</p>
        </div>
        <Button onClick={() => router.push('/dashboard/deals/new')}>
          <Plus className="w-4 h-4 mr-1.5" />
          New Deal
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4 pb-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by affiliate, email, broker..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Statuses</SelectItem>
                <SelectItem value="DRAFT">Draft</SelectItem>
                <SelectItem value="PENDING">Pending</SelectItem>
                <SelectItem value="ACTIVE">Active</SelectItem>
                <SelectItem value="REJECTED">Rejected</SelectItem>
                <SelectItem value="ARCHIVED">Archived</SelectItem>
              </SelectContent>
            </Select>
            <Select value={dealTypeFilter} onValueChange={setDealTypeFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Deal Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Types</SelectItem>
                <SelectItem value="CPA">CPA</SelectItem>
                <SelectItem value="PNL">PNL</SelectItem>
                <SelectItem value="HYBRID">HYBRID</SelectItem>
                <SelectItem value="REBATES">REBATES</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-3">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Handshake className="w-12 h-12 text-muted-foreground/40 mb-3" />
              <h3 className="text-lg font-medium">No deals found</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {deals.length === 0 ? 'Create your first deal to get started.' : 'Try adjusting your filters.'}
              </p>
              {deals.length === 0 && (
                <Button className="mt-4" onClick={() => router.push('/dashboard/deals/new')}>
                  <Plus className="w-4 h-4 mr-1.5" /> New Deal
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Affiliate / IB</TableHead>
                  <TableHead>Broker</TableHead>
                  <TableHead>Deal Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Last Updated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((deal) => (
                  <TableRow
                    key={deal.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => router.push(`/dashboard/deals/${deal.id}`)}
                  >
                    <TableCell>
                      <div>
                        <p className="font-medium">{deal.affiliate?.name || 'Unknown'}</p>
                        <p className="text-xs text-muted-foreground">{deal.affiliate?.email}</p>
                      </div>
                    </TableCell>
                    <TableCell>{deal.broker?.name || '—'}</TableCell>
                    <TableCell>
                      <span className="text-xs font-semibold bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded">
                        {deal.deal_type}
                      </span>
                    </TableCell>
                    <TableCell>
                      <DealStatusBadge status={deal.status} />
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(deal.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(deal.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
