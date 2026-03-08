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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { toast } from 'sonner'
import { Calendar, Plus, Search, Clock, CheckCircle2, XCircle, Download, ChevronRight, Trash2, Pencil } from 'lucide-react'
import Link from 'next/link'

const TYPE_COLORS = { MEETING:'bg-blue-50 text-blue-700 border-blue-200', CALL:'bg-green-50 text-green-700 border-green-200', FOLLOW_UP:'bg-purple-50 text-purple-700 border-purple-200' }
const STATUS_COLORS = { SCHEDULED:'bg-yellow-50 text-yellow-700 border-yellow-200', COMPLETED:'bg-green-50 text-green-700 border-green-200', CANCELLED:'bg-red-50 text-red-700 border-red-200' }
const EMPTY_FORM = { affiliate_id:'', title:'', appointment_type:'CALL', scheduled_at:'', notes:'', status:'SCHEDULED' }

export default function AppointmentsPage() {
  const [appointments, setAppointments] = useState([])
  const [affiliates, setAffiliates] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('upcoming')
  const [addOpen, setAddOpen] = useState(false)
  const [editTarget, setEditTarget] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [selected, setSelected] = useState(new Set())
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [userId, setUserId] = useState(null)
  const supabase = createClient()

  useEffect(() => { load() }, [])

  const load = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (user) setUserId(user.id)
    const [apptRes, affRes] = await Promise.all([
      supabase.from('appointments').select('*').order('scheduled_at', { ascending: true }),
      supabase.from('affiliates').select('id, name'),
    ])
    setAppointments(apptRes.data || [])
    setAffiliates(affRes.data || [])
    setLoading(false)
  }

  const getAffName = (id) => affiliates.find(a=>a.id===id)?.name || 'Unknown'
  const now = new Date()

  const filtered = appointments.filter(a => {
    if (search && !a.title?.toLowerCase().includes(search.toLowerCase()) && !getAffName(a.affiliate_id).toLowerCase().includes(search.toLowerCase())) return false
    if (typeFilter !== 'all' && a.appointment_type !== typeFilter) return false
    if (statusFilter === 'upcoming' && (new Date(a.scheduled_at) < now || a.status !== 'SCHEDULED')) return false
    return true
  })

  const grouped = {}
  filtered.forEach(a => {
    const dk = new Date(a.scheduled_at).toLocaleDateString('en-US', { weekday:'long', year:'numeric', month:'long', day:'numeric' })
    if (!grouped[dk]) grouped[dk] = []
    grouped[dk].push(a)
  })

  const openAdd = () => { setEditTarget(null); setForm(EMPTY_FORM); setAddOpen(true) }
  const openEdit = (a, e) => {
    e?.stopPropagation()
    setEditTarget(a)
    const dt = new Date(a.scheduled_at)
    const local = new Date(dt.getTime() - dt.getTimezoneOffset()*60000).toISOString().slice(0,16)
    setForm({ affiliate_id:a.affiliate_id, title:a.title, appointment_type:a.appointment_type, scheduled_at:local, notes:a.notes||'', status:a.status })
    setAddOpen(true)
  }

  const handleSave = async () => {
    if (!form.affiliate_id||!form.title||!form.scheduled_at) { toast.error('Affiliate, title and date required'); return }
    setSaving(true)
    const payload = { ...form, scheduled_at: new Date(form.scheduled_at).toISOString() }
    let error
    if (editTarget) {
      ({ error } = await supabase.from('appointments').update(payload).eq('id', editTarget.id))
    } else {
      ({ error } = await supabase.from('appointments').insert({ ...payload, user_id: userId }))
    }
    if (error) { toast.error(error.message); setSaving(false); return }
    toast.success(editTarget ? 'Appointment updated' : 'Appointment scheduled!')
    setAddOpen(false); setSaving(false); load()
  }

  const markStatus = async (id, status, e) => {
    e?.stopPropagation()
    const { error } = await supabase.from('appointments').update({ status }).eq('id', id)
    if (error) { toast.error(error.message); return }
    toast.success(`Appointment ${status.toLowerCase()}`)
    setAppointments(prev => prev.map(a => a.id===id ? {...a,status} : a))
  }

  const toggleSelect = (id) => setSelected(prev => { const n=new Set(prev); n.has(id)?n.delete(id):n.add(id); return n })
  const toggleAll = () => setSelected(prev => prev.size===filtered.length ? new Set() : new Set(filtered.map(a=>a.id)))

  const bulkDelete = async () => {
    const ids = Array.from(selected)
    const { error } = await supabase.from('appointments').delete().in('id', ids)
    if (error) { toast.error(error.message); return }
    toast.success(`Deleted ${ids.length} appointment(s)`)
    setAppointments(prev => prev.filter(a => !ids.includes(a.id)))
    setSelected(new Set()); setDeleteConfirm(false); load()
  }

  const exportCSV = () => {
    const toExport = selected.size > 0 ? filtered.filter(a => selected.has(a.id)) : filtered
    const headers = ['Affiliate','Title','Type','Date','Status','Notes']
    const rows = toExport.map(a=>[getAffName(a.affiliate_id),a.title,a.appointment_type,new Date(a.scheduled_at).toLocaleString(),a.status,a.notes||''])
    const csv = '\uFEFF' + [headers,...rows].map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n')
    const blob=new Blob([csv],{type:'text/csv;charset=utf-8;'}); const url=URL.createObjectURL(blob)
    const el=document.createElement('a'); el.href=url; el.download='appointments.csv'; el.click(); URL.revokeObjectURL(url)
  }

  const upcomingCount = appointments.filter(a=>new Date(a.scheduled_at)>=now&&a.status==='SCHEDULED').length
  const urgentCount = appointments.filter(a=>{ const d=new Date(a.scheduled_at); const diff=(d-now)/(1000*60*60*24); return diff>=0&&diff<=2&&a.status==='SCHEDULED' }).length

  if (loading) return <div className="space-y-3">{[...Array(4)].map((_,i)=><Skeleton key={i} className="h-20 rounded-xl" />)}</div>

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-outfit font-bold">Appointments</h1>
          <p className="text-sm text-muted-foreground">{upcomingCount} upcoming{urgentCount>0&&<span className="text-orange-600 font-medium ml-2">&bull; {urgentCount} in next 48h</span>}</p>
        </div>
        <div className="flex items-center gap-2">
          {selected.size>0&&<Button variant="destructive" size="sm" onClick={()=>setDeleteConfirm(true)}><Trash2 className="w-4 h-4 mr-1" />Delete {selected.size}</Button>}
          <Button variant="outline" size="sm" onClick={exportCSV}><Download className="w-4 h-4 mr-1" />Export</Button>
          <Button size="sm" onClick={openAdd}><Plus className="w-4 h-4 mr-1" />Schedule</Button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[{label:'Upcoming',value:appointments.filter(a=>new Date(a.scheduled_at)>=now&&a.status==='SCHEDULED').length,color:'text-blue-600'},{label:'Completed',value:appointments.filter(a=>a.status==='COMPLETED').length,color:'text-green-600'},{label:'Cancelled',value:appointments.filter(a=>a.status==='CANCELLED').length,color:'text-red-500'}].map(s=>(
          <Card key={s.label}><CardContent className="pt-3 pb-3 text-center"><p className={`text-2xl font-outfit font-bold ${s.color}`}>{s.value}</p><p className="text-xs text-muted-foreground">{s.label}</p></CardContent></Card>
        ))}
      </div>

      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-2 mb-5">
            {selected.size>0&&<span className="text-sm text-muted-foreground self-center">{selected.size} selected</span>}
            <div className="relative flex-1 min-w-[180px]"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" /><Input placeholder="Search..." value={search} onChange={e=>setSearch(e.target.value)} className="pl-9" /></div>
            <div className="flex border rounded-lg overflow-hidden">{[['upcoming','Upcoming'],['all','All History']].map(([v,l])=><button key={v} onClick={()=>setStatusFilter(v)} className={`px-3 py-2 text-sm font-medium transition-colors ${statusFilter===v?'bg-primary text-primary-foreground':'hover:bg-muted'}`}>{l}</button>)}</div>
            <Select value={typeFilter} onValueChange={setTypeFilter}><SelectTrigger className="w-36"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All Types</SelectItem><SelectItem value="CALL">Call</SelectItem><SelectItem value="MEETING">Meeting</SelectItem><SelectItem value="FOLLOW_UP">Follow-up</SelectItem></SelectContent></Select>
          </div>

          {Object.keys(grouped).length===0 ? (
            <div className="text-center py-14 text-muted-foreground">
              <Calendar className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p className="font-medium">{statusFilter==='upcoming'?'No upcoming appointments':'No appointments found'}</p>
              <p className="text-sm mt-1 mb-4">Schedule calls, meetings, and follow-ups with your affiliates</p>
              <Button size="sm" onClick={openAdd}><Plus className="w-4 h-4 mr-1" />Schedule first appointment</Button>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Select all for visible */}
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Checkbox checked={selected.size===filtered.length&&filtered.length>0} onCheckedChange={toggleAll} />
                <span>Select all {filtered.length} visible</span>
              </div>
              {Object.entries(grouped).map(([date,appts]) => {
                const isPast = new Date(appts[0].scheduled_at)<now
                return (
                  <div key={date}>
                    <div className="flex items-center gap-3 mb-3">
                      <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${isPast?'bg-muted-foreground/30':'bg-primary'}`} />
                      <p className={`text-sm font-semibold ${isPast?'text-muted-foreground':''}`}>{date}</p>
                      <div className="flex-1 h-px bg-border" />
                      <Badge variant="outline" className="text-xs">{appts.length}</Badge>
                    </div>
                    <div className="space-y-2 pl-5">
                      {appts.map(a => {
                        const apptDate=new Date(a.scheduled_at)
                        const diffH=(apptDate-now)/(1000*60*60)
                        const isVU=diffH>=0&&diffH<=24; const isU=diffH>=0&&diffH<=48
                        return (
                          <div key={a.id} className={`flex items-start gap-3 p-4 rounded-xl border transition-all cursor-pointer ${selected.has(a.id)?'bg-blue-50/50 border-blue-200':isVU?'bg-red-50/40 border-red-200':isU?'bg-orange-50/40 border-orange-200':isPast?'bg-muted/20 border-transparent opacity-70':'bg-card border-border hover:border-primary/30 hover:shadow-sm'}`}
                            onClick={()=>openEdit(a)}>
                            <div onClick={e=>e.stopPropagation()} className="pt-1"><Checkbox checked={selected.has(a.id)} onCheckedChange={()=>toggleSelect(a.id)} /></div>
                            <div className="shrink-0 w-12 text-center">
                              <p className="text-lg font-outfit font-bold leading-none">{apptDate.getDate()}</p>
                              <p className="text-xs text-muted-foreground">{apptDate.toLocaleString('en',{month:'short'})}</p>
                              <p className="text-xs font-medium mt-0.5">{apptDate.toLocaleTimeString('en',{hour:'2-digit',minute:'2-digit'})}</p>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="font-semibold text-sm">{a.title}</p>
                                <Badge className={`text-xs ${TYPE_COLORS[a.appointment_type]||''}`}>{a.appointment_type.replace('_',' ')}</Badge>
                                <Badge className={`text-xs ${STATUS_COLORS[a.status]||''}`}>{a.status}</Badge>
                                {isVU&&<Badge className="text-xs bg-red-50 text-red-700 border-red-200">Today!</Badge>}
                              </div>
                              <Link href={`/dashboard/affiliates/${a.affiliate_id}`} className="text-sm text-primary hover:underline flex items-center gap-1 mt-1 w-fit" onClick={e=>e.stopPropagation()}>
                                <Clock className="w-3 h-3" />{getAffName(a.affiliate_id)}<ChevronRight className="w-3 h-3" />
                              </Link>
                              {a.notes&&<p className="text-xs text-muted-foreground mt-1 truncate">{a.notes}</p>}
                            </div>
                            <div className="flex gap-1.5 shrink-0" onClick={e=>e.stopPropagation()}>
                              <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={e=>openEdit(a,e)}><Pencil className="w-3.5 h-3.5" /></Button>
                              {a.status==='SCHEDULED'&&(
                                <>
                                  <Button size="sm" variant="outline" className="h-8 text-xs text-green-600 border-green-200 hover:bg-green-50" onClick={e=>markStatus(a.id,'COMPLETED',e)}><CheckCircle2 className="w-3.5 h-3.5 mr-1" />Done</Button>
                                  <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-muted-foreground hover:text-red-500" onClick={e=>markStatus(a.id,'CANCELLED',e)}><XCircle className="w-3.5 h-3.5" /></Button>
                                </>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Modal */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Calendar className="w-4 h-4" />{editTarget?'Edit Appointment':'Schedule Appointment'}</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5"><Label>Affiliate <span className="text-destructive">*</span></Label>
              <Select value={form.affiliate_id} onValueChange={v=>setForm(f=>({...f,affiliate_id:v}))}><SelectTrigger><SelectValue placeholder="Select affiliate" /></SelectTrigger><SelectContent>{affiliates.map(a=><SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent></Select>
            </div>
            <div className="space-y-1.5"><Label>Title <span className="text-destructive">*</span></Label><Input value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))} placeholder="e.g. Monthly Review Call" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Type</Label><Select value={form.appointment_type} onValueChange={v=>setForm(f=>({...f,appointment_type:v}))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="CALL">Call</SelectItem><SelectItem value="MEETING">Meeting</SelectItem><SelectItem value="FOLLOW_UP">Follow-up</SelectItem></SelectContent></Select></div>
              <div className="space-y-1.5"><Label>Status</Label><Select value={form.status} onValueChange={v=>setForm(f=>({...f,status:v}))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="SCHEDULED">Scheduled</SelectItem><SelectItem value="COMPLETED">Completed</SelectItem><SelectItem value="CANCELLED">Cancelled</SelectItem></SelectContent></Select></div>
            </div>
            <div className="space-y-1.5"><Label>Date & Time <span className="text-destructive">*</span></Label><Input type="datetime-local" value={form.scheduled_at} onChange={e=>setForm(f=>({...f,scheduled_at:e.target.value}))} /></div>
            <div className="space-y-1.5"><Label>Notes</Label><Input value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} placeholder="Agenda, topics to discuss..." /></div>
            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" onClick={()=>setAddOpen(false)}>Cancel</Button>
              <Button onClick={handleSave} disabled={saving}>{saving?'Saving...':(editTarget?'Save Changes':'Schedule')}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteConfirm} onOpenChange={setDeleteConfirm}>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete {selected.size} appointment(s)?</AlertDialogTitle><AlertDialogDescription>This cannot be undone.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={bulkDelete} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
