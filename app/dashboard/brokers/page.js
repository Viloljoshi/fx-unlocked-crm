'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { toast } from 'sonner'
import { Search, Plus, Building2, Download, Trash2, Pencil } from 'lucide-react'
import { useUserRole } from '@/lib/hooks/useUserRole'

const EMPTY_FORM = {
  name: '', account_manager: '', contact_email: '', contact_phone: '',
  deal_types: '', notes: '', is_active: true
}

export default function BrokersPage() {
  const [brokers, setBrokers] = useState([])
  const [affiliateCounts, setAffiliateCounts] = useState({})
  const [revenueTotals, setRevenueTotals] = useState({})
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [addOpen, setAddOpen] = useState(false)
  const [editTarget, setEditTarget] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [selected, setSelected] = useState(new Set())
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const supabase = createClient()
  const { role, loading: roleLoading } = useUserRole()
  const isAdmin = role === 'ADMIN'

  useEffect(() => { load() }, [])

  const load = async () => {
    setLoading(true)
    const [brkRes, affRes, commRes] = await Promise.all([
      supabase.from('brokers').select('*').order('created_at', { ascending: false }),
      supabase.from('affiliates').select('id, broker_id'),
      supabase.from('commissions').select('broker_id, revenue_amount'),
    ])
    setBrokers(brkRes.data || [])
    const counts = {}; (affRes.data || []).forEach(a => { counts[a.broker_id] = (counts[a.broker_id] || 0) + 1 })
    setAffiliateCounts(counts)
    const rev = {}; (commRes.data || []).forEach(c => { rev[c.broker_id] = (rev[c.broker_id] || 0) + Number(c.revenue_amount || 0) })
    setRevenueTotals(rev)
    setLoading(false)
  }

  const filtered = brokers.filter(b => {
    if (search && !b.name?.toLowerCase().includes(search.toLowerCase())) return false
    if (statusFilter === 'active' && !b.is_active) return false
    if (statusFilter === 'inactive' && b.is_active) return false
    return true
  })

  const openAdd = () => { setEditTarget(null); setForm(EMPTY_FORM); setAddOpen(true) }
  const openEdit = (b, e) => { e.stopPropagation(); setEditTarget(b); setForm({ name: b.name, account_manager: b.account_manager || '', contact_email: b.contact_email || '', contact_phone: b.contact_phone || '', deal_types: b.deal_types || '', notes: b.notes || '', is_active: b.is_active !== false }); setAddOpen(true) }

  const handleSave = async () => {
    if (!form.name) { toast.error('Broker name is required'); return }
    setSaving(true)
    let error
    if (editTarget) {
      ({ error } = await supabase.from('brokers').update(form).eq('id', editTarget.id))
    } else {
      ({ error } = await supabase.from('brokers').insert(form))
    }
    if (error) { toast.error(error.message); setSaving(false); return }
    toast.success(editTarget ? 'Broker updated' : 'Broker added')
    setAddOpen(false); setSaving(false); load()
  }

  const toggleSelect = (id) => setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  const toggleAll = () => setSelected(prev => prev.size === filtered.length ? new Set() : new Set(filtered.map(b => b.id)))

  const bulkDelete = async () => {
    const ids = Array.from(selected)
    const { error } = await supabase.from('brokers').delete().in('id', ids)
    if (error) { toast.error(error.message); return }
    toast.success(`Deleted ${ids.length} broker(s)`)
    setSelected(new Set()); setDeleteConfirm(false); load()
  }

  const exportCSV = () => {
    const toExport = selected.size > 0 ? filtered.filter(b => selected.has(b.id)) : filtered
    const headers = ['Name', 'Account Manager', 'Contact Email', 'Deal Types', 'Affiliates', 'Revenue', 'Status']
    const rows = toExport.map(b => [b.name, b.account_manager || '', b.contact_email || '', b.deal_types || '', affiliateCounts[b.id] || 0, revenueTotals[b.id] || 0, b.is_active ? 'Active' : 'Inactive'])
    const csv = '\uFEFF' + [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'brokers.csv'; a.click(); URL.revokeObjectURL(url)
  }

  if (loading) return <div className="space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-12 rounded-lg" />)}</div>

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-outfit font-bold">Brokers</h1>
          <p className="text-sm text-muted-foreground">{brokers.length} brokers &bull; {filtered.length} shown</p>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && selected.size > 0 && (
            <Button variant="destructive" size="sm" onClick={() => setDeleteConfirm(true)}>
              <Trash2 className="w-4 h-4 mr-1" /> Delete {selected.size}
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={exportCSV}><Download className="w-4 h-4 mr-1" /> Export CSV</Button>
          {isAdmin && <Button size="sm" onClick={openAdd}><Plus className="w-4 h-4 mr-1" /> Add Broker</Button>}
        </div>
      </div>

      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-2 mb-4">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Search brokers..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
            </div>
            <div className="flex border rounded-lg overflow-hidden">
              {['all','active','inactive'].map(s => (
                <button key={s} onClick={() => setStatusFilter(s)} className={`px-3 py-2 text-sm font-medium capitalize transition-colors ${ statusFilter === s ? 'bg-primary text-primary-foreground' : 'hover:bg-muted' }`}>{s}</button>
              ))}
            </div>
          </div>

          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  {isAdmin && <TableHead className="w-10"><Checkbox checked={selected.size === filtered.length && filtered.length > 0} onCheckedChange={toggleAll} /></TableHead>}
                  <TableHead>Name</TableHead>
                  <TableHead>Account Manager</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Deal Types</TableHead>
                  <TableHead>Affiliates</TableHead>
                  <TableHead>Revenue</TableHead>
                  <TableHead>Status</TableHead>
                  {isAdmin && <TableHead className="w-10"></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={isAdmin ? 9 : 7} className="text-center py-10 text-muted-foreground">
                    <Building2 className="w-8 h-8 mx-auto mb-2 opacity-30" />No brokers found.
                  </TableCell></TableRow>
                ) : filtered.map(b => (
                  <TableRow key={b.id} className={`hover:bg-muted/30 ${isAdmin ? 'cursor-pointer' : ''} transition-colors ${selected.has(b.id) ? 'bg-blue-50/50' : ''}`} onClick={() => isAdmin && openEdit(b, { stopPropagation: () => {} })}>
                    {isAdmin && <TableCell onClick={e => e.stopPropagation()}><Checkbox checked={selected.has(b.id)} onCheckedChange={() => toggleSelect(b.id)} /></TableCell>}
                    <TableCell className="font-medium">{b.name}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{b.account_manager || '-'}</TableCell>
                    <TableCell className="text-muted-foreground text-xs">{b.contact_email || '-'}</TableCell>
                    <TableCell><div className="flex flex-wrap gap-1">{(b.deal_types||'').split(',').filter(Boolean).map(dt => <Badge key={dt} variant="outline" className="text-xs">{dt.trim()}</Badge>)}</div></TableCell>
                    <TableCell className="font-medium">{affiliateCounts[b.id] || 0}</TableCell>
                    <TableCell className="font-medium text-green-600">${(revenueTotals[b.id]||0).toLocaleString()}</TableCell>
                    <TableCell><Badge className={b.is_active ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}>{b.is_active ? 'Active' : 'Inactive'}</Badge></TableCell>
                    {isAdmin && <TableCell onClick={e => e.stopPropagation()}><Button variant="ghost" size="icon" className="h-7 w-7" onClick={e => openEdit(b, e)}><Pencil className="w-3.5 h-3.5" /></Button></TableCell>}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Add / Edit Modal */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Building2 className="w-4 h-4" /> {editTarget ? 'Edit Broker' : 'Add New Broker'}</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5"><Label>Broker Name <span className="text-destructive">*</span></Label><Input value={form.name} onChange={e => setForm(f=>({...f,name:e.target.value}))} placeholder="e.g. IC Markets" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Account Manager</Label><Input value={form.account_manager} onChange={e => setForm(f=>({...f,account_manager:e.target.value}))} /></div>
              <div className="space-y-1.5"><Label>Contact Email</Label><Input value={form.contact_email} onChange={e => setForm(f=>({...f,contact_email:e.target.value}))} type="email" /></div>
              <div className="space-y-1.5"><Label>Contact Phone</Label><Input value={form.contact_phone} onChange={e => setForm(f=>({...f,contact_phone:e.target.value}))} /></div>
              <div className="space-y-1.5"><Label>Deal Type</Label>
                <Select value={form.deal_types} onValueChange={v => setForm(f=>({...f, deal_types: v}))}>
                  <SelectTrigger><SelectValue placeholder="Select deal type" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CPA">CPA</SelectItem>
                    <SelectItem value="PNL">PNL</SelectItem>
                    <SelectItem value="HYBRID">HYBRID</SelectItem>
                    <SelectItem value="REBATES">REBATES</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5"><Label>Notes</Label><Input value={form.notes} onChange={e => setForm(f=>({...f,notes:e.target.value}))} /></div>
            <div className="flex items-center gap-3"><Switch checked={form.is_active} onCheckedChange={v=>setForm(f=>({...f,is_active:v}))} /><Label>Active Broker</Label></div>
            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" onClick={()=>setAddOpen(false)}>Cancel</Button>
              <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : (editTarget ? 'Save Changes' : 'Add Broker')}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bulk Delete Confirm */}
      <AlertDialog open={deleteConfirm} onOpenChange={setDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selected.size} broker(s)?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone. Associated affiliates will lose their broker link.</AlertDialogDescription>
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
