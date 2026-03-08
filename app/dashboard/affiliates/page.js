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

const STATUS_COLORS = {
  ACTIVE: 'bg-green-50 text-green-700 border-green-200',
  ONBOARDING: 'bg-blue-50 text-blue-700 border-blue-200',
  LEAD: 'bg-purple-50 text-purple-700 border-purple-200',
  INACTIVE: 'bg-red-50 text-red-700 border-red-200',
}

const EMPTY_FORM = {
  name: '', email: '', phone: '', status: 'LEAD',
  deal_type: 'CPA', broker_id: 'none', manager_id: 'none',
  manager_name_free: '', // free-text AM name when not in profiles
  country: '', website: '', deal_terms: '', notes: ''
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
    let affQuery = supabase.from('affiliates').select('*').order('created_at', { ascending: false })
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

  const getBrokerName = (id) => brokers.find(b => b.id === id)?.name || '-'

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
    if (dealTypeFilter !== 'all' && a.deal_type !== dealTypeFilter) return false
    if (brokerFilter !== 'all' && a.broker_id !== brokerFilter) return false
    return true
  })

  const openAdd = () => { setEditTarget(null); setForm({ ...EMPTY_FORM, manager_id: isAdmin ? 'none' : userId }); setAddOpen(true) }
  const openEdit = (a, e) => {
    e?.stopPropagation()
    setEditTarget(a)
    setForm({
      name: a.name, email: a.email, phone: a.phone || '',
      status: a.status, deal_type: a.deal_type,
      broker_id: a.broker_id || 'none', manager_id: a.manager_id || 'none',
      manager_name_free: a.deal_details?.account_manager_name || '',
      country: a.country || '', website: a.website || '',
      deal_terms: a.deal_terms || '', notes: a.notes || '',
    })
    setAddOpen(true)
  }

  const handleSave = async () => {
    if (!form.name || !form.email) { toast.error('Name and email are required'); return }
    setSaving(true)
    const payload = { ...form }
    // Handle manager
    if (!payload.broker_id || payload.broker_id === 'none') delete payload.broker_id
    if (!payload.manager_id || payload.manager_id === 'none') delete payload.manager_id
    // Store free-text AM name in deal_details JSONB
    if (payload.manager_name_free && !payload.manager_id) {
      payload.deal_details = { ...(payload.deal_details || {}), account_manager_name: payload.manager_name_free }
    }
    delete payload.manager_name_free
    let error
    if (editTarget) {
      ({ error } = await supabase.from('affiliates').update(payload).eq('id', editTarget.id))
    } else {
      ({ error } = await supabase.from('affiliates').insert(payload))
    }
    if (error) { toast.error(error.message); setSaving(false); return }
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
    const headers = ['Name', 'Email', 'Phone', 'Status', 'Deal Type', 'Broker', 'Manager', 'Country']
    const rows = toExport.map(a => [
      a.name, a.email, a.phone || '', a.status, a.deal_type,
      getBrokerName(a.broker_id), getManagerName(a), a.country || ''
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
                  <TableHead>Broker</TableHead>
                  <TableHead>Manager</TableHead>
                  <TableHead>Country</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={canWrite ? 9 : 8} className="text-center py-10 text-muted-foreground">
                    <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    No affiliates found. Click &ldquo;Add Affiliate&rdquo; to get started.
                  </TableCell></TableRow>
                ) : filtered.map(a => (
                  <TableRow key={a.id} className={`cursor-pointer hover:bg-muted/30 transition-colors ${selected.has(a.id) ? 'bg-blue-50/50' : ''}`} onClick={() => router.push(`/dashboard/affiliates/${a.id}`)}>
                    {canWrite && <TableCell onClick={e => e.stopPropagation()}><Checkbox checked={selected.has(a.id)} onCheckedChange={() => toggleSelect(a.id)} /></TableCell>}
                    <TableCell className="font-medium">{a.name}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{a.email}</TableCell>
                    <TableCell><Badge className={STATUS_COLORS[a.status] || ''}>{a.status}</Badge></TableCell>
                    <TableCell><Badge variant="outline" className="text-xs">{a.deal_type}</Badge></TableCell>
                    <TableCell className="text-sm">{getBrokerName(a.broker_id)}</TableCell>
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
                <Select value={form.deal_type} onValueChange={v => setForm(f => ({...f, deal_type: v}))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{['CPA','PNL','HYBRID','REBATES'].map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Broker</Label>
                <Select value={form.broker_id} onValueChange={v => setForm(f => ({...f, broker_id: v}))}>
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
                  value={form.manager_id}
                  valueText={form.manager_name_free}
                  onChange={v => setForm(f => ({...f, manager_id: v}))}
                  onChangeText={v => setForm(f => ({...f, manager_name_free: v}))}
                  placeholder="Search or type AM name..."
                />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>Website</Label>
                <Input value={form.website} onChange={e => setForm(f => ({...f, website: e.target.value}))} placeholder="https://..." />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>Deal Terms</Label>
                <Input value={form.deal_terms} onChange={e => setForm(f => ({...f, deal_terms: e.target.value}))} placeholder="e.g. $200 CPA, 30% RevShare" />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>Notes</Label>
                <Input value={form.notes} onChange={e => setForm(f => ({...f, notes: e.target.value}))} placeholder="Additional notes..." />
              </div>
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
