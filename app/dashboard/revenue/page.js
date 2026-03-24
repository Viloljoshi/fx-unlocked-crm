'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Checkbox } from '@/components/ui/checkbox'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { toast } from 'sonner'
import { DollarSign, Plus, Download, Trash2, Pencil, Check, Clock, TrendingUp } from 'lucide-react'
import { useUserRole } from '@/lib/hooks/useUserRole'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from 'recharts'

const MONTHS = ['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const DEAL_TYPES = ['CPA','PNL','HYBRID','REBATES']
const DEAL_TYPE_COLORS = { CPA: '#93c5fd', PNL: '#c4b5fd', HYBRID: '#86efac', REBATES: '#fde68a' }
const EMPTY_FORM = { affiliate_id: '', broker_id: 'none', month: new Date().getMonth()+1, year: new Date().getFullYear(), deal_type: 'CPA', revenue_amount: '', notes: '', status: 'PENDING' }

export default function RevenuePage() {
  const [commissions, setCommissions] = useState([])
  const [affiliates, setAffiliates] = useState([])
  const [brokers, setBrokers] = useState([])
  const [loading, setLoading] = useState(true)
  const [yearFilter, setYearFilter] = useState('all')
  const [monthFilter, setMonthFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [affiliateFilter, setAffiliateFilter] = useState('all')
  const [addOpen, setAddOpen] = useState(false)
  const [editTarget, setEditTarget] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [selected, setSelected] = useState(new Set())
  const [deleteConfirm, setDeleteConfirm] = useState(false)
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
    let affQuery = supabase.from('affiliates').select('id, name')
    if (role !== 'ADMIN') affQuery = affQuery.eq('manager_id', userId)

    const [affRes, brkRes] = await Promise.all([
      affQuery,
      supabase.from('brokers').select('id, name'),
    ])

    const myAffiliates = affRes.data || []

    // RLS on commissions already restricts STAFF to their own records —
    // no additional client-side filter needed.
    const { data: commData } = await supabase
      .from('commissions')
      .select('*')
      .order('year', { ascending: false })
      .order('month', { ascending: false })

    setCommissions(commData || [])
    setAffiliates(myAffiliates)
    setBrokers(brkRes.data || [])
    setLoading(false)
  }

  const getAffName = (id) => affiliates.find(a=>a.id===id)?.name || '-'
  const getBrkName = (id) => brokers.find(b=>b.id===id)?.name || '-'

  const filtered = commissions.filter(c => {
    if (yearFilter !== 'all' && c.year !== parseInt(yearFilter)) return false
    if (monthFilter !== 'all' && c.month !== parseInt(monthFilter)) return false
    if (statusFilter !== 'all' && c.status !== statusFilter) return false
    if (affiliateFilter !== 'all' && c.affiliate_id !== affiliateFilter) return false
    return true
  })

  const totalAmount = filtered.reduce((s,c) => s+Number(c.revenue_amount||0), 0)
  const pendingAmount = filtered.filter(c=>c.status==='PENDING'||c.status==='AWAITED').reduce((s,c) => s+Number(c.revenue_amount||0), 0)
  const paidAmount = filtered.filter(c=>c.status==='PAID').reduce((s,c) => s+Number(c.revenue_amount||0), 0)

  // Revenue by Deal Type (from filtered commissions)
  const dealTypeData = DEAL_TYPES.map(dt => ({
    name: dt,
    total: filtered.filter(c => c.deal_type === dt).reduce((s, c) => s + Number(c.revenue_amount || 0), 0),
    colour: DEAL_TYPE_COLORS[dt],
  })).filter(d => d.total > 0)

  const openAdd = () => { setEditTarget(null); setForm(EMPTY_FORM); setAddOpen(true) }
  const openEdit = (c, e) => {
    e?.stopPropagation()
    setEditTarget(c)
    setForm({ affiliate_id: c.affiliate_id, broker_id: c.broker_id || 'none', month: c.month, year: c.year, deal_type: c.deal_type, revenue_amount: c.revenue_amount, notes: c.notes || '', status: c.status || 'PENDING' })
    setAddOpen(true)
  }

  const handleSave = async () => {
    if (!form.affiliate_id || !form.revenue_amount) { toast.error('Affiliate and amount required'); return }
    if (parseFloat(form.revenue_amount) <= 0) { toast.error('Amount must be greater than 0'); return }
    setSaving(true)
    const payload = { ...form, month: parseInt(form.month), year: parseInt(form.year), revenue_amount: parseFloat(form.revenue_amount) }
    if (!payload.broker_id || payload.broker_id === 'none') delete payload.broker_id
    let error
    if (editTarget) {
      ({ error } = await supabase.from('commissions').update(payload).eq('id', editTarget.id))
    } else {
      ({ error } = await supabase.from('commissions').insert({ ...payload, staff_member_id: userId }))
    }
    if (error) { toast.error(error.message); setSaving(false); return }
    toast.success(editTarget ? 'Commission updated' : 'Commission added')
    setAddOpen(false); setSaving(false); load()
  }

  const markAsPaid = async (id, e) => {
    e?.stopPropagation()
    const { error } = await supabase.from('commissions').update({ status: 'PAID', paid_date: new Date().toISOString().split('T')[0] }).eq('id', id)
    if (error) { toast.error(error.message); return }
    toast.success('Marked as paid')
    setCommissions(prev => prev.map(c => c.id === id ? {...c, status:'PAID'} : c))
  }

  const toggleSelect = (id) => setSelected(prev => { const n = new Set(prev); n.has(id)?n.delete(id):n.add(id); return n })
  const toggleAll = () => setSelected(prev => prev.size===filtered.length ? new Set() : new Set(filtered.map(c=>c.id)))

  const bulkDelete = async () => {
    const ids = Array.from(selected)
    const { error } = await supabase.from('commissions').delete().in('id', ids)
    if (error) { toast.error(error.message); return }
    toast.success(`Deleted ${ids.length} commission(s)`)
    setSelected(new Set()); setDeleteConfirm(false); load()
  }

  const exportCSV = () => {
    const toExport = selected.size > 0 ? filtered.filter(c => selected.has(c.id)) : filtered
    const headers = ['Affiliate','Broker','Month','Year','Deal Type','Amount','Status']
    const rows = toExport.map(c => [getAffName(c.affiliate_id), getBrkName(c.broker_id), MONTHS[c.month], c.year, c.deal_type, c.revenue_amount, c.status])
    const csv = '\uFEFF' + [headers,...rows].map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n')
    const blob = new Blob([csv],{type:'text/csv;charset=utf-8;'}); const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href=url; a.download='revenue.csv'; a.click(); URL.revokeObjectURL(url)
  }

  const fmt = (n) => `$${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 0 })}`

  if (loading) return <div className="space-y-3">{[...Array(5)].map((_,i)=><Skeleton key={i} className="h-12 rounded-lg" />)}</div>

  return (
    <div className="space-y-5">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-outfit font-bold">Revenue & Commissions</h1>
          <p className="text-sm text-muted-foreground">Track and manage commission records</p>
        </div>
        <div className="flex items-center gap-2">
          {canWrite && selected.size > 0 && (
            <Button variant="destructive" size="sm" onClick={() => setDeleteConfirm(true)}>
              <Trash2 className="w-4 h-4 mr-1" /> Delete {selected.size}
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={exportCSV}><Download className="w-4 h-4 mr-1" /> Export CSV</Button>
          {canWrite && <Button size="sm" onClick={openAdd}><Plus className="w-4 h-4 mr-1" /> Add Commission</Button>}
        </div>
      </div>

      {/* 3 Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4 pb-4 px-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                <DollarSign className="w-4 h-4 text-blue-500" />
              </div>
            </div>
            <p className="text-2xl font-outfit font-bold">{fmt(totalAmount)}</p>
            <p className="text-xs font-medium text-foreground mt-0.5">Total Revenue</p>
            <p className="text-xs text-muted-foreground">{filtered.length} commission{filtered.length !== 1 ? 's' : ''}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 px-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-green-500" />
              </div>
            </div>
            <p className="text-2xl font-outfit font-bold text-green-600">{fmt(paidAmount)}</p>
            <p className="text-xs font-medium text-foreground mt-0.5">Total Paid</p>
            <p className="text-xs text-muted-foreground">Confirmed payments</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 px-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-yellow-50 flex items-center justify-center">
                <Clock className="w-4 h-4 text-yellow-500" />
              </div>
            </div>
            <p className="text-2xl font-outfit font-bold text-yellow-600">{fmt(pendingAmount)}</p>
            <p className="text-xs font-medium text-foreground mt-0.5">Total Pending</p>
            <p className="text-xs text-muted-foreground">Pending & Awaited</p>
          </CardContent>
        </Card>
      </div>

      {/* Revenue by Deal Type Chart */}
      {dealTypeData.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Revenue by Deal Type</CardTitle>
            <p className="text-xs text-muted-foreground">Based on current filters</p>
          </CardHeader>
          <CardContent>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dealTypeData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="name" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `$${v >= 1000 ? (v/1000).toFixed(0)+'k' : v}`} />
                  <Tooltip
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }}
                    formatter={(val) => [`$${Number(val).toLocaleString()}`, 'Revenue']}
                  />
                  <Bar dataKey="total" radius={[6, 6, 0, 0]} name="Revenue">
                    {dealTypeData.map((d, i) => <Cell key={i} fill={d.colour} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            {/* Summary breakdown */}
            <div className="flex flex-wrap gap-3 mt-3 pt-3 border-t">
              {dealTypeData.map(d => (
                <div key={d.name} className="flex items-center gap-2 text-sm">
                  <div className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: d.colour }} />
                  <span className="text-muted-foreground">{d.name}</span>
                  <span className="font-medium">${d.total.toLocaleString()}</span>
                  <span className="text-xs text-muted-foreground">({totalAmount > 0 ? Math.round((d.total/totalAmount)*100) : 0}%)</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters + Commission Table */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-2 mb-4">
            <Select value={yearFilter} onValueChange={setYearFilter}><SelectTrigger className="w-28"><SelectValue placeholder="Year" /></SelectTrigger><SelectContent><SelectItem value="all">All Years</SelectItem>{[2023,2024,2025,2026].map(y=><SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}</SelectContent></Select>
            <Select value={monthFilter} onValueChange={setMonthFilter}><SelectTrigger className="w-28"><SelectValue placeholder="Month" /></SelectTrigger><SelectContent><SelectItem value="all">All Months</SelectItem>{MONTHS.slice(1).map((m,i)=><SelectItem key={i+1} value={(i+1).toString()}>{m}</SelectItem>)}</SelectContent></Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger className="w-32"><SelectValue placeholder="Status" /></SelectTrigger><SelectContent><SelectItem value="all">All Status</SelectItem><SelectItem value="PENDING">Pending</SelectItem><SelectItem value="PAID">Paid</SelectItem><SelectItem value="AWAITED">Awaited</SelectItem><SelectItem value="CANCELLED">Cancelled</SelectItem></SelectContent></Select>
            <Select value={affiliateFilter} onValueChange={setAffiliateFilter}><SelectTrigger className="w-44"><SelectValue placeholder="Affiliate" /></SelectTrigger><SelectContent><SelectItem value="all">All Affiliates</SelectItem>{affiliates.map(a=><SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent></Select>
          </div>

          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  {canWrite && <TableHead className="w-10"><Checkbox checked={selected.size===filtered.length&&filtered.length>0} onCheckedChange={toggleAll} /></TableHead>}
                  <TableHead>Affiliate</TableHead><TableHead>Broker</TableHead><TableHead>Period</TableHead><TableHead>Deal Type</TableHead><TableHead>Amount</TableHead><TableHead>Status</TableHead>
                  <TableHead className="w-20">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length===0 ? (
                  <TableRow><TableCell colSpan={canWrite ? 8 : 7} className="text-center py-10 text-muted-foreground"><DollarSign className="w-8 h-8 mx-auto mb-2 opacity-30" />No commissions found.</TableCell></TableRow>
                ) : filtered.map(c => (
                  <TableRow key={c.id} className={`hover:bg-muted/30 transition-colors ${canWrite ? 'cursor-pointer' : ''} ${selected.has(c.id)?'bg-blue-50/50':''}`} onClick={()=>canWrite && openEdit(c)}>
                    {canWrite && <TableCell onClick={e=>e.stopPropagation()}><Checkbox checked={selected.has(c.id)} onCheckedChange={()=>toggleSelect(c.id)} /></TableCell>}
                    <TableCell className="font-medium">{getAffName(c.affiliate_id)}</TableCell>
                    <TableCell className="text-sm">{getBrkName(c.broker_id)}</TableCell>
                    <TableCell className="text-sm">{MONTHS[c.month]} {c.year}</TableCell>
                    <TableCell><Badge variant="outline" className="text-xs">{c.deal_type}</Badge></TableCell>
                    <TableCell className="font-semibold text-green-600">${Number(c.revenue_amount).toLocaleString()}</TableCell>
                    <TableCell><Badge className={c.status==='PAID'?'bg-green-50 text-green-700 border-green-200':c.status==='AWAITED'?'bg-blue-50 text-blue-700 border-blue-200':c.status==='CANCELLED'?'bg-red-50 text-red-700 border-red-200':'bg-yellow-50 text-yellow-700 border-yellow-200'}>{c.status}</Badge></TableCell>
                    <TableCell onClick={e=>e.stopPropagation()}>
                      <div className="flex gap-1">
                        {canWrite && <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={e=>openEdit(c,e)}><Pencil className="w-3.5 h-3.5" /></Button>}
                        {isAdmin && c.status==='PENDING' && <Button size="sm" variant="outline" className="h-7 text-xs text-green-600 border-green-200 hover:bg-green-50 px-2" onClick={e=>markAsPaid(c.id,e)}><Check className="w-3 h-3" /></Button>}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Add/Edit Modal */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editTarget ? 'Edit Commission' : 'Add Commission'}</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5"><Label>Affiliate <span className="text-destructive">*</span></Label>
              <Select value={form.affiliate_id} onValueChange={v=>setForm(f=>({...f,affiliate_id:v}))}><SelectTrigger><SelectValue placeholder="Select affiliate" /></SelectTrigger><SelectContent>{affiliates.map(a=><SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent></Select>
            </div>
            <div className="space-y-1.5"><Label>Broker</Label>
              <Select value={form.broker_id} onValueChange={v=>setForm(f=>({...f,broker_id:v}))}><SelectTrigger><SelectValue placeholder="Select broker" /></SelectTrigger><SelectContent><SelectItem value="none">None</SelectItem>{brokers.map(b=><SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent></Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Month</Label><Select value={form.month.toString()} onValueChange={v=>setForm(f=>({...f,month:parseInt(v)}))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{MONTHS.slice(1).map((m,i)=><SelectItem key={i+1} value={(i+1).toString()}>{m}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-1.5"><Label>Year</Label><Select value={form.year.toString()} onValueChange={v=>setForm(f=>({...f,year:parseInt(v)}))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{[2023,2024,2025,2026].map(y=><SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-1.5"><Label>Deal Type</Label><Select value={form.deal_type} onValueChange={v=>setForm(f=>({...f,deal_type:v}))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{DEAL_TYPES.map(d=><SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-1.5"><Label>Amount ($) <span className="text-destructive">*</span></Label><Input value={form.revenue_amount} onChange={e=>setForm(f=>({...f,revenue_amount:e.target.value}))} placeholder="0.00" type="number" min="0" /></div>
            </div>
            <div className="space-y-1.5"><Label>Status</Label><Select value={form.status} onValueChange={v=>setForm(f=>({...f,status:v}))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="PENDING">Pending</SelectItem><SelectItem value="PAID">Paid</SelectItem><SelectItem value="AWAITED">Awaited</SelectItem><SelectItem value="CANCELLED">Cancelled</SelectItem></SelectContent></Select></div>
            <div className="space-y-1.5"><Label>Notes</Label><Input value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} placeholder="Optional notes..." /></div>
            <div className="flex gap-2 justify-end pt-2"><Button variant="outline" onClick={()=>setAddOpen(false)}>Cancel</Button><Button onClick={handleSave} disabled={saving}>{saving?'Saving...':(editTarget?'Save Changes':'Add Commission')}</Button></div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteConfirm} onOpenChange={setDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete {selected.size} commission(s)?</AlertDialogTitle><AlertDialogDescription>This cannot be undone.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={bulkDelete} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
