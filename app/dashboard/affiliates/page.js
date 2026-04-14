'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { Search, Plus, Users, Download, ChevronDown, X, Trash2, Pencil } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { Checkbox } from '@/components/ui/checkbox'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { useUserRole } from '@/lib/hooks/useUserRole'
import DealTypeFields from '@/components/deal-type-fields/DealTypeFields'
import AffiliateCombobox from '@/components/affiliate-combobox/AffiliateCombobox'

const STATUS_COLORS = {
  ACTIVE: 'bg-green-50 text-green-700 border-green-200',
  ONBOARDING: 'bg-blue-50 text-blue-700 border-blue-200',
  LEAD: 'bg-purple-50 text-purple-700 border-purple-200',
  INACTIVE: 'bg-red-50 text-red-700 border-red-200',
}

const EMPTY_FORM = {
  name: '', email: '', phone: '', status: 'LEAD',
  deal_type: '', broker_ids: [], manager_id: 'none',
  master_ib_id: 'none',
  manager_name_free: '', // free-text AM name when not in profiles
  country: '', website: '', deal_terms: '', notes: '',
  deal_data: {}, // deal-type-specific fields stored in deal_details.deal JSONB
  trade_ideas: '',
  instagram: false, telegram: false, signal_handle: false,
}

function BrokerMultiSelect({ brokers, value = [], onChange }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])
  const toggle = (id) => onChange(value.includes(id) ? value.filter(v => v !== id) : [...value, id])
  const selectedNames = value.map(id => brokers.find(b => b.id === id)?.name).filter(Boolean)
  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen(o => !o)}
        className="flex items-center justify-between w-full border rounded-md px-3 py-2 text-sm bg-background min-h-[36px] gap-2 hover:bg-muted/30 transition-colors">
        <span className="flex-1 text-left truncate">
          {selectedNames.length > 0 ? selectedNames.join(', ') : <span className="text-muted-foreground">Select brokers...</span>}
        </span>
        <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
      </button>
      {open && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-card border rounded-md shadow-lg max-h-48 overflow-y-auto">
          {brokers.length === 0
            ? <div className="px-3 py-2 text-xs text-muted-foreground">No brokers found</div>
            : brokers.map(b => (
              <label key={b.id} className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted/50 cursor-pointer select-none">
                <Checkbox checked={value.includes(b.id)} onCheckedChange={() => toggle(b.id)} />
                {b.name}
              </label>
            ))
          }
        </div>
      )}
    </div>
  )
}

// Combobox: shows profiles as dropdown suggestions + allows free-text
function ManagerCombobox({ profiles, value, valueText, onChange, onChangeText, placeholder }) {
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

  const handleSelect = (profile) => {
    onChange(profile.id)
    onChangeText('')
    setSearch('')
    setOpen(false)
  }

  const handleClear = (e) => {
    e.stopPropagation()
    onChange('none')
    onChangeText('')
    setSearch('')
  }

  return (
    <div className="relative" ref={ref}>
      <div
        className="flex items-center border rounded-md px-3 py-2 text-sm cursor-text bg-background min-h-[36px] gap-2"
        onClick={() => { setOpen(true); setTimeout(() => ref.current?.querySelector('input')?.focus(), 50) }}
      >
        {displayLabel ? (
          <>
            <span className="flex-1 truncate">{displayLabel}</span>
            <button type="button" onClick={handleClear} className="text-muted-foreground hover:text-foreground">
              <X className="w-3.5 h-3.5" />
            </button>
          </>
        ) : (
          <>
            <input
              className="flex-1 bg-transparent outline-none placeholder:text-muted-foreground"
              placeholder={placeholder || 'Search or type name...'}
              value={open ? search : ''}
              onChange={e => { setSearch(e.target.value); onChangeText(e.target.value); setOpen(true) }}
              onFocus={() => setOpen(true)}
            />
            <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          </>
        )}
      </div>

      {open && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-card border rounded-md shadow-lg max-h-48 overflow-y-auto">
          {displayLabel && (
            <div className="p-2 border-b">
              <input
                autoFocus
                className="w-full text-sm outline-none bg-transparent placeholder:text-muted-foreground"
                placeholder="Search profiles..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          )}
          {filtered.length === 0 && !search && (
            <div className="px-3 py-2 text-xs text-muted-foreground">No profiles found. Type a name to set manually.</div>
          )}
          {filtered.map(p => (
            <button key={p.id} type="button"
              className="w-full text-left px-3 py-2 text-sm hover:bg-muted/50 transition-colors"
              onClick={() => handleSelect(p)}>
              {p.first_name} {p.last_name}
              <span className="text-xs text-muted-foreground ml-1">({p.role})</span>
            </button>
          ))}
          {search && (
            <button type="button"
              className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 text-blue-600 border-t transition-colors"
              onClick={() => { onChange('none'); onChangeText(search); setOpen(false) }}>
              <Plus className="w-3.5 h-3.5 inline mr-1" /> Use &ldquo;{search}&rdquo; as AM name
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export default function AffiliatesPage() {
  const [affiliates, setAffiliates] = useState([])
  const [brokers, setBrokers] = useState([])
  const [profiles, setProfiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [dealTypeFilter, setDealTypeFilter] = useState('all')
  const [brokerFilter, setBrokerFilter] = useState('all')
  const [tradeIdeasFilter, setTradeIdeasFilter] = useState('all')
  const [channelFilter, setChannelFilter] = useState('all')
  const [addOpen, setAddOpen] = useState(false)
  const [editTarget, setEditTarget] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [selected, setSelected] = useState(new Set())
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const router = useRouter()
  const supabase = createClient()
  const { userId, role, loading: roleLoading } = useUserRole()
  const isAdmin = role === 'ADMIN'
  const canWrite = role === 'ADMIN' || role === 'STAFF'

  useEffect(() => {
    if (roleLoading || !userId || !role) return
    load()
  }, [roleLoading, userId, role])

  const load = async () => {
    setLoading(true)
    // Staff see only their own affiliates; admin sees all
    let affQuery = supabase.from('affiliates').select('*, affiliate_brokers(broker_id)').order('created_at', { ascending: false })
    if (role && role !== 'ADMIN') affQuery = affQuery.eq('manager_id', userId)

    const [affRes, brkRes, profRes] = await Promise.all([
      affQuery,
      supabase.from('brokers').select('id, name'),
      supabase.from('profiles').select('id, first_name, last_name, role'),
    ])
    setAffiliates(affRes.data || [])
    setBrokers(brkRes.data || [])
    setProfiles(profRes.data || [])
    setLoading(false)
  }

  const getBrokerNames = (affiliateBrokers) => {
    const names = (affiliateBrokers || []).map(ab => brokers.find(b => b.id === ab.broker_id)?.name).filter(Boolean)
    return names.length > 0 ? names.join(', ') : '-'
  }
  const getMasterIBName = (id) => affiliates.find(a => a.id === id)?.name || '-'

  // Display manager: prefer linked profile, fallback to deal_details.account_manager_name
  const getManagerName = (aff) => {
    if (aff.manager_id) {
      const p = profiles.find(p => p.id === aff.manager_id)
      if (p) return `${p.first_name} ${p.last_name}`.trim() || p.first_name || 'Unknown'
    }
    return aff.deal_details?.account_manager_name || '-'
  }

  const filtered = affiliates.filter(a => {
    if (search && !a.name?.toLowerCase().includes(search.toLowerCase()) && !a.email?.toLowerCase().includes(search.toLowerCase())) return false
    if (statusFilter !== 'all' && a.status !== statusFilter) return false
    if (dealTypeFilter === 'NONE' && a.deal_type) return false
    if (dealTypeFilter !== 'all' && dealTypeFilter !== 'NONE' && a.deal_type !== dealTypeFilter) return false
    if (brokerFilter !== 'all') {
      const ids = (a.affiliate_brokers || []).map(ab => ab.broker_id)
      if (!ids.includes(brokerFilter)) return false
    }
    if (tradeIdeasFilter === 'yes' && (!a.trade_ideas || a.trade_ideas.trim() === '')) return false
    if (tradeIdeasFilter === 'no' && a.trade_ideas && a.trade_ideas.trim() !== '') return false
    if (channelFilter === 'instagram' && !a.instagram) return false
    if (channelFilter === 'telegram' && !a.telegram) return false
    if (channelFilter === 'signal' && !a.signal_handle) return false
    return true
  })

  const openAdd = () => { setEditTarget(null); setForm({ ...EMPTY_FORM, manager_id: isAdmin ? 'none' : userId }); setAddOpen(true) }
  const openEdit = (a, e) => {
    e?.stopPropagation()
    setEditTarget(a)
    setForm({
      name: a.name, email: a.email, phone: a.phone || '',
      status: a.status, deal_type: a.deal_type || '',
      broker_ids: a.affiliate_brokers?.map(ab => ab.broker_id) || [], manager_id: a.manager_id || 'none',
      master_ib_id: a.master_ib_id || 'none',
      manager_name_free: a.deal_details?.account_manager_name || '',
      country: a.country || '', website: a.website || '',
      deal_terms: a.deal_terms || '', notes: a.notes || '',
      deal_data: a.deal_details?.deal || {},
      trade_ideas: a.trade_ideas || '',
      instagram: a.instagram || false, telegram: a.telegram || false, signal_handle: a.signal_handle || false,
    })
    setAddOpen(true)
  }

  const handleSave = async () => {
    if (!form.name || !form.email) { toast.error('Name and email are required'); return }
    setSaving(true)
    const brokerIds = form.broker_ids || []
    const payload = { ...form }

    // Remove non-column fields
    delete payload.broker_ids
    delete payload.affiliate_brokers

    // Handle FK references: convert 'none' → null
    if (!payload.manager_id || payload.manager_id === 'none') { payload.manager_id = null }
    if (!payload.master_ib_id || payload.master_ib_id === 'none') { payload.master_ib_id = null }

    // Handle empty deal_type → null for DB
    if (!payload.deal_type) payload.deal_type = null

    // Build deal_details JSONB: merge AM name, deal notes, and deal-type-specific data
    const existingDetails = editTarget?.deal_details || {}
    const dealDetails = { ...existingDetails }

    // Store free-text AM name
    if (payload.manager_name_free && !payload.manager_id) {
      dealDetails.account_manager_name = payload.manager_name_free
    } else if (payload.manager_id) {
      delete dealDetails.account_manager_name
    }

    // Store deal-type-specific fields under deal_details.deal
    if (payload.deal_type && payload.deal_data && Object.keys(payload.deal_data).length > 0) {
      dealDetails.deal = payload.deal_data
    } else if (!payload.deal_type) {
      // No deal type selected — clear deal data
      delete dealDetails.deal
    }

    payload.deal_details = Object.keys(dealDetails).length > 0 ? dealDetails : null

    // Remove form-only fields that aren't DB columns
    delete payload.manager_name_free
    delete payload.deal_data

    let error, savedId
    if (editTarget) {
      ;({ error } = await supabase.from('affiliates').update(payload).eq('id', editTarget.id))
      savedId = editTarget.id
    } else {
      const { data: ins, error: insErr } = await supabase.from('affiliates').insert(payload).select('id').single()
      error = insErr
      savedId = ins?.id
    }
    if (error) { toast.error(error.message); setSaving(false); return }

    // Sync affiliate_brokers junction table
    await supabase.from('affiliate_brokers').delete().eq('affiliate_id', savedId)
    if (brokerIds.length > 0) {
      await supabase.from('affiliate_brokers').insert(brokerIds.map(bid => ({ affiliate_id: savedId, broker_id: bid })))
    }

    // Send status-change email to the affiliate if status changed (or new affiliate with a notifiable status)
    const prevStatus = editTarget?.status
    const newStatus = payload.status
    const notifiableStatuses = ['ACTIVE', 'ONBOARDING', 'INACTIVE']
    if (notifiableStatuses.includes(newStatus) && newStatus !== prevStatus) {
      // Fetch broker names for the approved email (non-blocking — don't await)
      const brokerNames = brokerIds.length > 0
        ? (await supabase.from('brokers').select('name').in('id', brokerIds)).data?.map(b => b.name).join(', ')
        : null
      fetch('/api/affiliates/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: payload.email,
          name: payload.name,
          status: newStatus,
          brokers: brokerNames,
        }),
      }).catch(err => console.error('Affiliate notify (non-fatal):', err))
    }

    toast.success(editTarget ? 'Affiliate updated' : 'Affiliate added successfully')
    setAddOpen(false)
    setForm(EMPTY_FORM)
    setSaving(false)
    load()
  }

  const toggleSelect = (id) => setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  const toggleAll = () => setSelected(prev => prev.size === filtered.length ? new Set() : new Set(filtered.map(a => a.id)))

  const bulkDelete = async () => {
    const ids = Array.from(selected)
    const { error } = await supabase.from('affiliates').delete().in('id', ids)
    if (error) { toast.error(error.message); return }
    toast.success(`Deleted ${ids.length} affiliate(s)`)
    setSelected(new Set()); setDeleteConfirm(false); load()
  }

  const exportCSV = () => {
    const toExport = selected.size > 0 ? filtered.filter(a => selected.has(a.id)) : filtered
    const headers = ['Name', 'Email', 'Phone', 'Status', 'Deal Type', 'Broker', 'Manager', 'Master IB', 'Country']
    const rows = toExport.map(a => [
      a.name, a.email, a.phone || '', a.status, a.deal_type || '',
      getBrokerNames(a.affiliate_brokers), getManagerName(a), getMasterIBName(a.master_ib_id), a.country || ''
    ])
    const csv = '\uFEFF' + [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'affiliates.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  if (loading) return <div className="space-y-3">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 rounded-lg" />)}</div>

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-outfit font-bold">Affiliates</h1>
          <p className="text-sm text-muted-foreground">{affiliates.length} total &bull; {filtered.length} shown</p>
        </div>
        <div className="flex items-center gap-2">
          {canWrite && selected.size > 0 && (
            <Button variant="destructive" size="sm" onClick={() => setDeleteConfirm(true)}>
              <Trash2 className="w-4 h-4 mr-1" /> Delete {selected.size}
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={exportCSV}>
            <Download className="w-4 h-4 mr-1" /> Export CSV
          </Button>
          {canWrite && <Button size="sm" onClick={openAdd}><Plus className="w-4 h-4 mr-1" /> Add Affiliate</Button>}
        </div>
      </div>

      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-2 mb-4">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Search name or email..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-36"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                {['ACTIVE','ONBOARDING','LEAD','INACTIVE'].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={dealTypeFilter} onValueChange={setDealTypeFilter}>
              <SelectTrigger className="w-36"><SelectValue placeholder="Deal Type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="NONE">No Type</SelectItem>
                {['CPA','PNL','HYBRID','REBATES'].map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={brokerFilter} onValueChange={setBrokerFilter}>
              <SelectTrigger className="w-40"><SelectValue placeholder="Broker" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Brokers</SelectItem>
                {brokers.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={tradeIdeasFilter} onValueChange={setTradeIdeasFilter}>
              <SelectTrigger className="w-40"><SelectValue placeholder="Trade Ideas" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="yes">Trade Ideas</SelectItem>
                <SelectItem value="no">No Trade Ideas</SelectItem>
              </SelectContent>
            </Select>
            <Select value={channelFilter} onValueChange={setChannelFilter}>
              <SelectTrigger className="w-40"><SelectValue placeholder="Channel" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Channels</SelectItem>
                <SelectItem value="instagram">Instagram</SelectItem>
                <SelectItem value="telegram">Telegram</SelectItem>
                <SelectItem value="signal">Signal</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  {canWrite && <TableHead className="w-10"><Checkbox checked={selected.size === filtered.length && filtered.length > 0} onCheckedChange={toggleAll} /></TableHead>}
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Deal Type</TableHead>
                  <TableHead>Master IB</TableHead>
                  <TableHead>Broker</TableHead>
                  <TableHead>Manager</TableHead>
                  <TableHead>Country</TableHead>
                  {canWrite && <TableHead className="w-10"></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={canWrite ? 10 : 8} className="text-center py-10 text-muted-foreground">
                    <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    {canWrite ? 'No affiliates found. Click "Add Affiliate" to get started.' : 'No affiliates found.'}
                  </TableCell></TableRow>
                ) : filtered.map(a => (
                  <TableRow key={a.id} className={`cursor-pointer hover:bg-muted/30 transition-colors ${selected.has(a.id) ? 'bg-blue-50/50' : ''}`} onClick={() => router.push(`/dashboard/affiliates/${a.id}`)}>
                    {canWrite && <TableCell onClick={e => e.stopPropagation()}><Checkbox checked={selected.has(a.id)} onCheckedChange={() => toggleSelect(a.id)} /></TableCell>}
                    <TableCell className="font-medium">{a.name}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{a.email}</TableCell>
                    <TableCell><Badge className={STATUS_COLORS[a.status] || ''}>{a.status}</Badge></TableCell>
                    <TableCell>{a.deal_type ? <Badge variant="outline" className="text-xs">{a.deal_type}</Badge> : <span className="text-xs text-muted-foreground">-</span>}</TableCell>
                    <TableCell className="text-sm">{getMasterIBName(a.master_ib_id)}</TableCell>
                    <TableCell className="text-sm">{getBrokerNames(a.affiliate_brokers)}</TableCell>
                    <TableCell className="text-sm">{getManagerName(a)}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{a.country || '-'}</TableCell>
                    {canWrite && <TableCell onClick={e => e.stopPropagation()}><Button variant="ghost" size="icon" className="h-7 w-7" onClick={e => openEdit(a, e)}><Pencil className="w-3.5 h-3.5" /></Button></TableCell>}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Add Affiliate Modal */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Pencil className="w-4 h-4" /> {editTarget ? 'Edit Affiliate' : 'Add New Affiliate'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1.5">
                <Label>Name <span className="text-destructive">*</span></Label>
                <Input value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} placeholder="Full name" />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>Email <span className="text-destructive">*</span></Label>
                <Input value={form.email} onChange={e => setForm(f => ({...f, email: e.target.value}))} placeholder="email@example.com" type="email" />
              </div>
              <div className="space-y-1.5">
                <Label>Phone</Label>
                <Input value={form.phone} onChange={e => setForm(f => ({...f, phone: e.target.value}))} placeholder="+1 234 567 8900" />
              </div>
              <div className="space-y-1.5">
                <Label>Country</Label>
                <Input value={form.country} onChange={e => setForm(f => ({...f, country: e.target.value}))} placeholder="US, UK, AU..." />
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={v => setForm(f => ({...f, status: v}))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{['LEAD','ONBOARDING','ACTIVE','INACTIVE'].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Deal Type</Label>
                <Select value={form.deal_type || '__none__'} onValueChange={v => setForm(f => ({...f, deal_type: v === '__none__' ? '' : v, deal_data: v === '__none__' ? {} : (v !== f.deal_type ? {} : f.deal_data)}))}>
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
                  affiliates={affiliates}
                  value={form.master_ib_id}
                  onChange={v => setForm(f => ({...f, master_ib_id: v}))}
                  excludeId={editTarget?.id}
                  placeholder="Search Master IB..."
                />
              </div>
              <div className="space-y-1.5">
                <Label>Brokers</Label>
                <BrokerMultiSelect brokers={brokers} value={form.broker_ids} onChange={v => setForm(f => ({...f, broker_ids: v}))} />
              </div>
              <div className="space-y-1.5">
                <Label>Account Manager</Label>
                <p className="text-xs text-muted-foreground -mt-1">Pick from list or type any name</p>
                <ManagerCombobox
                  profiles={profiles}
                  value={form.manager_id}
                  valueText={form.manager_name_free}
                  onChange={v => setForm(f => ({...f, manager_id: v}))}
                  onChangeText={v => setForm(f => ({...f, manager_name_free: v}))}
                  placeholder="Search or type AM name..."
                />
              </div>
              <div className="space-y-1.5">
                <Label>Trade Ideas</Label>
                <Input value={form.trade_ideas} onChange={e => setForm(f => ({...f, trade_ideas: e.target.value}))} placeholder="e.g. Forex signals, Copy trading..." />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>Website</Label>
                <Input value={form.website} onChange={e => setForm(f => ({...f, website: e.target.value}))} placeholder="https://..." />
              </div>
              <div className="col-span-2 flex items-center gap-6 pt-1">
                <span className="text-sm font-medium">Channels</span>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <Checkbox checked={form.instagram || false} onCheckedChange={v => setForm(f => ({...f, instagram: !!v}))} />
                  <span className="text-sm">Instagram</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <Checkbox checked={form.telegram || false} onCheckedChange={v => setForm(f => ({...f, telegram: !!v}))} />
                  <span className="text-sm">Telegram</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <Checkbox checked={form.signal_handle || false} onCheckedChange={v => setForm(f => ({...f, signal_handle: !!v}))} />
                  <span className="text-sm">Signal</span>
                </label>
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>Deal Terms</Label>
                <Input value={form.deal_terms} onChange={e => setForm(f => ({...f, deal_terms: e.target.value}))} placeholder="e.g. $200 CPA, 30% RevShare" />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>Notes</Label>
                <Input value={form.notes} onChange={e => setForm(f => ({...f, notes: e.target.value}))} placeholder="Additional notes..." />
              </div>
              {/* Dynamic deal-type-specific fields */}
              <DealTypeFields
                dealType={form.deal_type}
                dealData={form.deal_data}
                onChange={data => setForm(f => ({...f, deal_data: data}))}
              />
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
              <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : (editTarget ? 'Save Changes' : 'Add Affiliate')}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteConfirm} onOpenChange={setDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selected.size} affiliate(s)?</AlertDialogTitle>
            <AlertDialogDescription>This cannot be undone. All associated commissions and notes will lose their affiliate link.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={bulkDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
