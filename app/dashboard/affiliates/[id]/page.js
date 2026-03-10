'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { ArrowLeft, Mail, Phone, Globe, MapPin, Calendar, Edit2, Save, X, ChevronDown, Plus, Users } from 'lucide-react'
import Link from 'next/link'
import { useUserRole } from '@/lib/hooks/useUserRole'
import DealTypeFields from '@/components/deal-type-fields/DealTypeFields'
import AffiliateCombobox from '@/components/affiliate-combobox/AffiliateCombobox'

// Combobox for free-text + profile search
function ManagerCombobox({ profiles, value, valueText, onChange, onChangeText }) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const ref = useRef(null)

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const filtered = profiles.filter(p => {
    const fullName = `${p.first_name} ${p.last_name}`.toLowerCase()
    return !search || fullName.includes(search.toLowerCase())
  })
  const selectedProfile = profiles.find(p => p.id === value)
  const displayLabel = selectedProfile
    ? `${selectedProfile.first_name} ${selectedProfile.last_name}`.trim()
    : valueText || ''

  return (
    <div className="relative" ref={ref}>
      <div className="flex items-center border rounded-md px-3 py-2 text-sm cursor-text bg-background min-h-[36px] gap-2"
        onClick={() => { setOpen(true); setTimeout(() => ref.current?.querySelector('input')?.focus(), 50) }}>
        {displayLabel ? (
          <>
            <span className="flex-1 truncate">{displayLabel}</span>
            <button type="button" onClick={e => { e.stopPropagation(); onChange('none'); onChangeText(''); setSearch('') }} className="text-muted-foreground hover:text-foreground">
              <X className="w-3.5 h-3.5" />
            </button>
          </>
        ) : (
          <>
            <input className="flex-1 bg-transparent outline-none placeholder:text-muted-foreground text-sm"
              placeholder="Search or type AM name..." value={open ? search : ''}
              onChange={e => { setSearch(e.target.value); onChangeText(e.target.value); setOpen(true) }}
              onFocus={() => setOpen(true)} />
            <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          </>
        )}
      </div>
      {open && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-card border rounded-md shadow-lg max-h-48 overflow-y-auto">
          {displayLabel && <div className="p-2 border-b"><input autoFocus className="w-full text-sm outline-none bg-transparent" placeholder="Search profiles..." value={search} onChange={e => setSearch(e.target.value)} /></div>}
          {filtered.length === 0 && !search && <div className="px-3 py-2 text-xs text-muted-foreground">No profiles. Type a name to set manually.</div>}
          {filtered.map(p => (
            <button key={p.id} type="button" className="w-full text-left px-3 py-2 text-sm hover:bg-muted/50"
              onClick={() => { onChange(p.id); onChangeText(''); setSearch(''); setOpen(false) }}>
              {p.first_name} {p.last_name} <span className="text-xs text-muted-foreground">({p.role})</span>
            </button>
          ))}
          {search && (
            <button type="button" className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 text-blue-600 border-t"
              onClick={() => { onChange('none'); onChangeText(search); setOpen(false) }}>
              <Plus className="w-3.5 h-3.5 inline mr-1" /> Use &ldquo;{search}&rdquo; as AM name
            </button>
          )}
        </div>
      )}
    </div>
  )
}

const STATUS_COLORS = {
  ACTIVE: 'bg-green-50 text-green-700 border-green-200',
  ONBOARDING: 'bg-blue-50 text-blue-700 border-blue-200',
  LEAD: 'bg-purple-50 text-purple-700 border-purple-200',
  INACTIVE: 'bg-red-50 text-red-700 border-red-200',
}

export default function AffiliateDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const { role } = useUserRole()
  const canWrite = role === 'ADMIN' || role === 'STAFF'
  const [affiliate, setAffiliate] = useState(null)
  const [broker, setBroker] = useState(null)
  const [manager, setManager] = useState(null)
  const [masterIB, setMasterIB] = useState(null)
  const [subAffiliates, setSubAffiliates] = useState([])
  const [allAffiliates, setAllAffiliates] = useState([])
  const [brokers, setBrokers] = useState([])
  const [profiles, setProfiles] = useState([])
  const [notes, setNotes] = useState([])
  const [appointments, setAppointments] = useState([])
  const [commissions, setCommissions] = useState([])
  const [loading, setLoading] = useState(true)
  const [editOpen, setEditOpen] = useState(false)
  const [editForm, setEditForm] = useState({})
  const [editManagerNameFree, setEditManagerNameFree] = useState('')
  const [editDealData, setEditDealData] = useState({})
  const [dealNotes, setDealNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const supabase = createClient()

  useEffect(() => { load() }, [id])

  const load = async () => {
    setLoading(true)
    const [affRes, brkListRes, profListRes, allAffRes] = await Promise.all([
      supabase.from('affiliates').select('*').eq('id', id).single(),
      supabase.from('brokers').select('id, name'),
      supabase.from('profiles').select('id, first_name, last_name'),
      supabase.from('affiliates').select('id, name, status, deal_type'),
    ])
    const aff = affRes.data
    setAllAffiliates(allAffRes.data || [])
    if (aff) {
      setAffiliate(aff)
      setEditForm({
        ...aff,
        broker_id: aff.broker_id || 'none',
        manager_id: aff.manager_id || 'none',
        master_ib_id: aff.master_ib_id || 'none',
        deal_type: aff.deal_type || '',
      })
      setEditManagerNameFree(aff.deal_details?.account_manager_name || '')
      setEditDealData(aff.deal_details?.deal || {})
      setDealNotes(aff.deal_details?.notes || '')
      if (aff.broker_id) {
        const { data: brk } = await supabase.from('brokers').select('*').eq('id', aff.broker_id).single()
        setBroker(brk)
      }
      if (aff.manager_id) {
        const { data: mgr } = await supabase.from('profiles').select('*').eq('id', aff.manager_id).single()
        setManager(mgr)
      }
      if (aff.master_ib_id) {
        const { data: mib } = await supabase.from('affiliates').select('id, name').eq('id', aff.master_ib_id).single()
        setMasterIB(mib)
      } else {
        setMasterIB(null)
      }
      // Fetch sub-affiliates
      const { data: subs } = await supabase.from('affiliates').select('id, name, status, deal_type').eq('master_ib_id', id)
      setSubAffiliates(subs || [])
    }
    setBrokers(brkListRes.data || [])
    setProfiles(profListRes.data || [])
    const [notesRes, apptRes, commRes] = await Promise.all([
      supabase.from('affiliate_notes').select('*').eq('affiliate_id', id).order('created_at', { ascending: false }),
      supabase.from('appointments').select('*').eq('affiliate_id', id).order('scheduled_at', { ascending: false }),
      supabase.from('commissions').select('*').eq('affiliate_id', id).order('year', { ascending: false }),
    ])
    setNotes(notesRes.data || [])
    setAppointments(apptRes.data || [])
    setCommissions(commRes.data || [])
    setLoading(false)
  }

  const handleEdit = async () => {
    setSaving(true)
    const payload = { ...editForm }

    // Handle FK references
    if (!payload.broker_id || payload.broker_id === 'none') payload.broker_id = null
    if (!payload.manager_id || payload.manager_id === 'none') payload.manager_id = null
    if (!payload.master_ib_id || payload.master_ib_id === 'none') payload.master_ib_id = null
    if (!payload.deal_type) payload.deal_type = null

    // Build deal_details
    const dealDetails = { ...(affiliate?.deal_details || {}) }

    // Free-text AM name
    if (editManagerNameFree && !payload.manager_id) {
      dealDetails.account_manager_name = editManagerNameFree
    } else if (payload.manager_id) {
      delete dealDetails.account_manager_name
    }

    // Deal-type-specific data
    if (payload.deal_type && editDealData && Object.keys(editDealData).length > 0) {
      dealDetails.deal = editDealData
    } else if (!payload.deal_type) {
      delete dealDetails.deal
    }

    payload.deal_details = Object.keys(dealDetails).length > 0 ? dealDetails : null

    const { error } = await supabase.from('affiliates').update(payload).eq('id', id)
    if (error) { toast.error(error.message); setSaving(false); return }
    toast.success('Affiliate updated')
    setEditOpen(false)
    setSaving(false)
    load()
  }

  const handleDealNotesSave = async () => {
    setSaving(true)
    const existing = affiliate.deal_details || {}
    const updated = { ...existing, notes: dealNotes }
    const { error } = await supabase.from('affiliates').update({ deal_details: updated }).eq('id', id)
    if (error) { toast.error(error.message); setSaving(false); return }
    toast.success('Deal notes saved')
    setSaving(false)
    setAffiliate(prev => ({ ...prev, deal_details: updated }))
  }

  if (loading) return <div className="space-y-4">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)}</div>
  if (!affiliate) return (
    <div className="text-center py-20 text-muted-foreground space-y-4">
      <p className="text-4xl">🔍</p>
      <p className="text-lg font-medium text-foreground">Affiliate not found</p>
      <p className="text-sm">This affiliate may have been deleted or the link is invalid.</p>
      <Link href="/dashboard/affiliates"><Button variant="outline" className="mt-2"><ArrowLeft className="w-4 h-4 mr-2" />Back to Affiliates</Button></Link>
    </div>
  )

  const totalRevenue = commissions.reduce((s, c) => s + Number(c.revenue_amount || 0), 0)

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/affiliates">
            <Button variant="outline" size="icon" className="h-8 w-8">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-outfit font-bold">{affiliate.name}</h1>
            <div className="flex items-center gap-2 mt-0.5">
              <Badge className={STATUS_COLORS[affiliate.status] || ''}>{affiliate.status}</Badge>
              {affiliate.deal_type ? <Badge variant="outline" className="text-xs">{affiliate.deal_type}</Badge> : <Badge variant="outline" className="text-xs text-muted-foreground">No Deal Type</Badge>}
            </div>
          </div>
        </div>
        {canWrite && (
          <Button variant="outline" size="sm" onClick={() => {
            // Reset form state from current affiliate data to avoid stale state after cancel
            setEditForm({
              ...affiliate,
              broker_id: affiliate.broker_id || 'none',
              manager_id: affiliate.manager_id || 'none',
              master_ib_id: affiliate.master_ib_id || 'none',
              deal_type: affiliate.deal_type || '',
            })
            setEditManagerNameFree(affiliate.deal_details?.account_manager_name || '')
            setEditDealData(affiliate.deal_details?.deal || {})
            setEditOpen(true)
          }}>
            <Edit2 className="w-4 h-4 mr-1" /> Edit
          </Button>
        )}
      </div>

      {/* Quick Info Cards */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1"><Mail className="w-3.5 h-3.5" /> Email</div>
            <p className="font-medium text-sm truncate">{affiliate.email}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1"><Phone className="w-3.5 h-3.5" /> Phone</div>
            <p className="font-medium text-sm">{affiliate.phone || '-'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1"><MapPin className="w-3.5 h-3.5" /> Country</div>
            <p className="font-medium text-sm">{affiliate.country || '-'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1"><Calendar className="w-3.5 h-3.5" /> Start Date</div>
            <p className="font-medium text-sm">{affiliate.start_date ? new Date(affiliate.start_date).toLocaleDateString() : '-'}</p>
          </CardContent>
        </Card>
      </div>

      {/* Details + Revenue */}
      <div className="grid lg:grid-cols-3 gap-5">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3"><CardTitle className="text-base">Details</CardTitle></CardHeader>
          <CardContent className="grid sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <div><span className="text-muted-foreground block text-xs">Master IB</span><p className="font-medium">{masterIB ? <Link href={`/dashboard/affiliates/${masterIB.id}`} className="text-primary hover:underline">{masterIB.name}</Link> : '-'}</p></div>
            <div><span className="text-muted-foreground block text-xs">Broker</span><p className="font-medium">{broker?.name || '-'}</p></div>
            <div><span className="text-muted-foreground block text-xs">Manager</span><p className="font-medium">{manager ? `${manager.first_name} ${manager.last_name}` : affiliate.deal_details?.account_manager_name || '-'}</p></div>
            <div><span className="text-muted-foreground block text-xs">Traffic Region</span><p className="font-medium">{affiliate.traffic_region || '-'}</p></div>
            <div><span className="text-muted-foreground block text-xs">Source</span><p className="font-medium">{affiliate.source || '-'}</p></div>
            <div><span className="text-muted-foreground block text-xs">Website</span><p className="font-medium">{affiliate.website ? <a href={affiliate.website} target="_blank" rel="noopener" className="text-primary hover:underline">{affiliate.website}</a> : '-'}</p></div>
            <div><span className="text-muted-foreground block text-xs">Renewal Date</span><p className="font-medium">{affiliate.renewal_date ? new Date(affiliate.renewal_date).toLocaleDateString() : '-'}</p></div>
            {affiliate.deal_terms && <div className="sm:col-span-2"><span className="text-muted-foreground block text-xs">Deal Terms</span><p className="font-medium mt-0.5">{affiliate.deal_terms}</p></div>}
            {affiliate.notes && <div className="sm:col-span-2"><span className="text-muted-foreground block text-xs">Notes</span><p className="font-medium mt-0.5">{affiliate.notes}</p></div>}
            {/* Read-only deal-type-specific fields */}
            {affiliate.deal_type && affiliate.deal_details?.deal && (
              <div className="sm:col-span-2">
                <DealTypeFields dealType={affiliate.deal_type} dealData={affiliate.deal_details.deal} readOnly />
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Revenue</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-muted-foreground text-xs">Total Revenue</p>
              <p className="text-2xl font-outfit font-bold text-green-600">${totalRevenue.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Total Commissions</p>
              <p className="text-lg font-semibold">{commissions.length}</p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {affiliate.instagram && <Badge variant="outline" className="text-xs">Instagram</Badge>}
              {affiliate.telegram && <Badge variant="outline" className="text-xs">Telegram</Badge>}
              {affiliate.x_handle && <Badge variant="outline" className="text-xs">X/Twitter</Badge>}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sub-Affiliates */}
      {subAffiliates.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2"><Users className="w-4 h-4" /> Sub-Affiliates ({subAffiliates.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader><TableRow className="bg-muted/50"><TableHead>Name</TableHead><TableHead>Status</TableHead><TableHead>Deal Type</TableHead></TableRow></TableHeader>
                <TableBody>
                  {subAffiliates.map(sub => (
                    <TableRow key={sub.id} className="cursor-pointer hover:bg-muted/30" onClick={() => router.push(`/dashboard/affiliates/${sub.id}`)}>
                      <TableCell className="font-medium">{sub.name}</TableCell>
                      <TableCell><Badge className={STATUS_COLORS[sub.status] || ''}>{sub.status}</Badge></TableCell>
                      <TableCell>{sub.deal_type ? <Badge variant="outline" className="text-xs">{sub.deal_type}</Badge> : <span className="text-xs text-muted-foreground">-</span>}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs defaultValue="notes">
        <TabsList>
          <TabsTrigger value="notes">Notes ({notes.length})</TabsTrigger>
          <TabsTrigger value="appointments">Appointments ({appointments.length})</TabsTrigger>
          <TabsTrigger value="commissions">Commissions ({commissions.length})</TabsTrigger>
          <TabsTrigger value="deal">Deal Notes</TabsTrigger>
        </TabsList>

        <TabsContent value="notes">
          <Card>
            <CardContent className="pt-4">
              {notes.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p className="text-sm">No notes yet. Use the Cmd+K bar and type @note to add one.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {notes.map(n => (
                    <div key={n.id} className="p-3 rounded-lg bg-muted/30 border">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="text-xs">{n.note_type || 'GENERAL'}</Badge>
                        <span className="text-xs text-muted-foreground">{new Date(n.created_at).toLocaleString()}</span>
                      </div>
                      <p className="text-sm">{n.content}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="appointments">
          <Card>
            <CardContent className="pt-4">
              {appointments.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p className="text-sm">No appointments. Use the Cmd+K bar and type @appointment to add one.</p>
                </div>
              ) : (
                <div className="rounded-lg border overflow-hidden">
                  <Table>
                    <TableHeader><TableRow className="bg-muted/50"><TableHead>Title</TableHead><TableHead>Type</TableHead><TableHead>Date</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {appointments.map(a => (
                        <TableRow key={a.id} className="hover:bg-muted/30">
                          <TableCell className="font-medium">{a.title}</TableCell>
                          <TableCell><Badge variant="outline" className="text-xs">{a.appointment_type}</Badge></TableCell>
                          <TableCell className="text-sm">{new Date(a.scheduled_at).toLocaleString()}</TableCell>
                          <TableCell><Badge variant="outline" className="text-xs">{a.status}</Badge></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="commissions">
          <Card>
            <CardContent className="pt-4">
              {commissions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p className="text-sm">No commissions yet. Use the Cmd+K bar and type @commission to add one.</p>
                </div>
              ) : (
                <div className="rounded-lg border overflow-hidden">
                  <Table>
                    <TableHeader><TableRow className="bg-muted/50"><TableHead>Period</TableHead><TableHead>Deal Type</TableHead><TableHead>Amount</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {commissions.map(c => (
                        <TableRow key={c.id} className="hover:bg-muted/30">
                          <TableCell className="font-medium">{c.month}/{c.year}</TableCell>
                          <TableCell><Badge variant="outline" className="text-xs">{c.deal_type}</Badge></TableCell>
                          <TableCell className="font-semibold text-green-600">${Number(c.revenue_amount).toLocaleString()}</TableCell>
                          <TableCell>
                            <Badge className={c.status === 'PAID' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-yellow-50 text-yellow-700 border-yellow-200'} >{c.status}</Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="deal">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Deal Notes</CardTitle>
              <p className="text-sm text-muted-foreground">Add notes about the deal — CPA terms, special conditions, negotiation history, etc.</p>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea
                value={dealNotes}
                onChange={e => canWrite && setDealNotes(e.target.value)}
                readOnly={!canWrite}
                className={`text-sm min-h-[200px] ${!canWrite ? 'opacity-70 cursor-default' : ''}`}
                placeholder="e.g. CPA $200 per qualified lead, 30% revshare on net deposits, 90-day renewal cycle..."
              />
              {canWrite && (
                <div className="flex justify-end">
                  <Button onClick={handleDealNotesSave} disabled={saving} size="sm">
                    <Save className="w-4 h-4 mr-1" /> Save Notes
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit Affiliate Modal */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Edit2 className="w-4 h-4" /> Edit Affiliate</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1.5">
                <Label>Name</Label>
                <Input value={editForm.name || ''} onChange={e => setEditForm(f => ({...f, name: e.target.value}))} />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>Email</Label>
                <Input value={editForm.email || ''} onChange={e => setEditForm(f => ({...f, email: e.target.value}))} type="email" />
              </div>
              <div className="space-y-1.5">
                <Label>Phone</Label>
                <Input value={editForm.phone || ''} onChange={e => setEditForm(f => ({...f, phone: e.target.value}))} />
              </div>
              <div className="space-y-1.5">
                <Label>Country</Label>
                <Input value={editForm.country || ''} onChange={e => setEditForm(f => ({...f, country: e.target.value}))} />
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={editForm.status || 'LEAD'} onValueChange={v => setEditForm(f => ({...f, status: v}))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{['LEAD','ONBOARDING','ACTIVE','INACTIVE'].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Deal Type</Label>
                <Select value={editForm.deal_type || '__none__'} onValueChange={v => { const dt = v === '__none__' ? '' : v; setEditForm(f => ({...f, deal_type: dt})); if (dt !== editForm.deal_type) setEditDealData({}); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">None</SelectItem>
                    {['CPA','PNL','HYBRID','REBATES'].map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Master IB</Label>
                <AffiliateCombobox
                  affiliates={allAffiliates}
                  value={editForm.master_ib_id || 'none'}
                  onChange={v => setEditForm(f => ({...f, master_ib_id: v}))}
                  excludeId={id}
                  placeholder="Search Master IB..."
                />
              </div>
              <div className="space-y-1.5">
                <Label>Broker</Label>
                <Select value={editForm.broker_id || 'none'} onValueChange={v => setEditForm(f => ({...f, broker_id: v}))}>
                  <SelectTrigger><SelectValue placeholder="Select broker" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {brokers.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Account Manager</Label>
                <p className="text-xs text-muted-foreground -mt-1">Pick from list or type any name</p>
                <ManagerCombobox
                  profiles={profiles}
                  value={editForm.manager_id || 'none'}
                  valueText={editManagerNameFree}
                  onChange={v => setEditForm(f => ({...f, manager_id: v}))}
                  onChangeText={setEditManagerNameFree}
                />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>Website</Label>
                <Input value={editForm.website || ''} onChange={e => setEditForm(f => ({...f, website: e.target.value}))} />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>Deal Terms</Label>
                <Input value={editForm.deal_terms || ''} onChange={e => setEditForm(f => ({...f, deal_terms: e.target.value}))} />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>Notes</Label>
                <Input value={editForm.notes || ''} onChange={e => setEditForm(f => ({...f, notes: e.target.value}))} />
              </div>
              {/* Dynamic deal-type-specific fields */}
              <DealTypeFields
                dealType={editForm.deal_type}
                dealData={editDealData}
                onChange={setEditDealData}
              />
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
              <Button onClick={handleEdit} disabled={saving}>{saving ? 'Saving...' : 'Save Changes'}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
