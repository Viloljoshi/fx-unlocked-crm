'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Search, UserCog, Download, Trash2, ShieldAlert, Target, Plus, Pencil, Users, DollarSign, TrendingUp } from 'lucide-react'
import { toast } from 'sonner'
import { useUserRole } from '@/lib/hooks/useUserRole'

const MONTHS = ['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const CURRENT_YEAR = new Date().getFullYear()
const YEARS = [CURRENT_YEAR - 1, CURRENT_YEAR, CURRENT_YEAR + 1]

const EMPTY_KPI_FORM = {
  staff_member_id: '',
  month: '', // '' = yearly
  year: CURRENT_YEAR,
  target_revenue: '',
  target_affiliates: '',
  notes: '',
}

function PctBadge({ pct }) {
  const colour = pct >= 100 ? 'text-green-600' : pct >= 70 ? 'text-yellow-600' : 'text-red-500'
  return <span className={`text-xs font-semibold ${colour}`}>{pct}%</span>
}

export default function StaffPage() {
  const { role, loading: roleLoading } = useUserRole()
  const isAdmin = role === 'ADMIN'

  // Team tab state
  const [staff, setStaff] = useState([])
  const [affiliateCounts, setAffiliateCounts] = useState({})
  const [revenueTotals, setRevenueTotals] = useState({})
  const [loadingTeam, setLoadingTeam] = useState(true)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)

  // KPI tab state
  const [activeTab, setActiveTab] = useState('team')
  const [kpis, setKpis] = useState([])
  const [commissions, setCommissions] = useState([])
  const [affiliatesAll, setAffiliatesAll] = useState([])
  const [kpiYear, setKpiYear] = useState(CURRENT_YEAR.toString())
  const [kpiStaffFilter, setKpiStaffFilter] = useState('all')
  const [loadingKpi, setLoadingKpi] = useState(false)
  const [kpiDialogOpen, setKpiDialogOpen] = useState(false)
  const [kpiForm, setKpiForm] = useState(EMPTY_KPI_FORM)
  const [editingKpi, setEditingKpi] = useState(null)
  const [savingKpi, setSavingKpi] = useState(false)

  const supabase = createClient()

  // ── Load team ──────────────────────────────────────────────────────────
  const loadTeam = useCallback(async () => {
    setLoadingTeam(true)
    const [staffRes, affRes, commRes] = await Promise.all([
      supabase.from('profiles').select('*').order('created_at', { ascending: false }),
      supabase.from('affiliates').select('id, manager_id'),
      supabase.from('commissions').select('staff_member_id, revenue_amount'),
    ])
    setStaff(staffRes.data || [])
    const counts = {}
    ;(affRes.data || []).forEach(a => { if (a.manager_id) counts[a.manager_id] = (counts[a.manager_id] || 0) + 1 })
    setAffiliateCounts(counts)
    const rev = {}
    ;(commRes.data || []).forEach(c => { if (c.staff_member_id) rev[c.staff_member_id] = (rev[c.staff_member_id] || 0) + Number(c.revenue_amount || 0) })
    setRevenueTotals(rev)
    setLoadingTeam(false)
  }, [])

  // ── Load KPIs ──────────────────────────────────────────────────────────
  const loadKpis = useCallback(async () => {
    setLoadingKpi(true)
    const yr = parseInt(kpiYear)
    const [kpiRes, commRes, affRes] = await Promise.all([
      supabase.from('staff_kpis').select('*').eq('year', yr),
      supabase.from('commissions').select('staff_member_id, revenue_amount, month, year').eq('year', yr),
      supabase.from('affiliates').select('id, manager_id, created_at'),
    ])
    setKpis(kpiRes.data || [])
    setCommissions(commRes.data || [])
    setAffiliatesAll(affRes.data || [])
    setLoadingKpi(false)
  }, [kpiYear])

  useEffect(() => { loadTeam() }, [loadTeam])
  useEffect(() => { if (activeTab === 'kpis') loadKpis() }, [activeTab, loadKpis])

  // ── Actuals calculation ────────────────────────────────────────────────
  const getActualRevenue = (staffId, month) => {
    return commissions
      .filter(c => c.staff_member_id === staffId && (month ? c.month === month : true))
      .reduce((s, c) => s + Number(c.revenue_amount || 0), 0)
  }

  const getActualAffiliates = (staffId, month) => {
    const yr = parseInt(kpiYear)
    return affiliatesAll.filter(a => {
      if (a.manager_id !== staffId) return false
      if (!a.created_at) return false
      const d = new Date(a.created_at)
      if (d.getFullYear() !== yr) return false
      if (month && d.getMonth() + 1 !== month) return false
      return true
    }).length
  }

  // ── Rows for KPI table ─────────────────────────────────────────────────
  // Build rows: for each staff member show all their KPI entries for selected year
  const kpiRows = (() => {
    const filtered = kpiStaffFilter === 'all' ? staff : staff.filter(s => s.id === kpiStaffFilter)
    const rows = []
    filtered.forEach(s => {
      const memberKpis = kpis.filter(k => k.staff_member_id === s.id)
      if (memberKpis.length === 0) {
        // No KPIs set — show placeholder row
        rows.push({ staff: s, kpi: null, isPlaceholder: true })
      } else {
        memberKpis.sort((a, b) => (a.month || 13) - (b.month || 13))
        memberKpis.forEach((kpi, idx) => rows.push({ staff: s, kpi, isFirst: idx === 0, rowspan: memberKpis.length }))
      }
    })
    return rows
  })()

  // ── Team filter ────────────────────────────────────────────────────────
  const filteredStaff = staff.filter(s => {
    const fullName = `${s.first_name} ${s.last_name}`.toLowerCase()
    if (search && !fullName.includes(search.toLowerCase())) return false
    if (roleFilter !== 'all' && s.role !== roleFilter) return false
    if (statusFilter === 'active' && !s.is_active) return false
    if (statusFilter === 'inactive' && s.is_active) return false
    return true
  })

  // ── Delete staff ───────────────────────────────────────────────────────
  const deleteUser = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res = await fetch('/api/users/delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: deleteTarget.id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Delete failed')
      const name = [deleteTarget.first_name, deleteTarget.last_name].filter(Boolean).join(' ') || deleteTarget.email || 'Staff member'
      toast.success(`${name} removed`)
      setStaff(prev => prev.filter(s => s.id !== deleteTarget.id))
    } catch (err) {
      toast.error(err.message)
    } finally {
      setDeleting(false)
      setDeleteTarget(null)
    }
  }

  // ── Save KPI ───────────────────────────────────────────────────────────
  const saveKpi = async () => {
    if (!kpiForm.staff_member_id) { toast.error('Select a staff member'); return }
    if (!kpiForm.year) { toast.error('Year is required'); return }
    setSavingKpi(true)
    const payload = {
      staff_member_id: kpiForm.staff_member_id,
      year: parseInt(kpiForm.year),
      month: (kpiForm.month && kpiForm.month !== '0') ? parseInt(kpiForm.month) : null,
      target_revenue: kpiForm.target_revenue !== '' ? parseFloat(kpiForm.target_revenue) : null,
      target_affiliates: kpiForm.target_affiliates !== '' ? parseInt(kpiForm.target_affiliates) : null,
      notes: kpiForm.notes || null,
    }
    let error
    if (editingKpi) {
      ;({ error } = await supabase.from('staff_kpis').update(payload).eq('id', editingKpi.id))
    } else {
      ;({ error } = await supabase.from('staff_kpis').upsert(payload, { onConflict: 'staff_member_id,year,month' }))
    }
    if (error) { toast.error(error.message); setSavingKpi(false); return }
    toast.success(editingKpi ? 'KPI target updated' : 'KPI target set')
    setKpiDialogOpen(false)
    setKpiForm(EMPTY_KPI_FORM)
    setEditingKpi(null)
    setSavingKpi(false)
    loadKpis()
  }

  const openAddKpi = (staffMember = null) => {
    setEditingKpi(null)
    setKpiForm({ ...EMPTY_KPI_FORM, staff_member_id: staffMember?.id || '' })
    setKpiDialogOpen(true)
  }

  const openEditKpi = (kpi) => {
    setEditingKpi(kpi)
    setKpiForm({
      staff_member_id: kpi.staff_member_id,
      month: kpi.month ? kpi.month.toString() : '0',
      year: kpi.year,
      target_revenue: kpi.target_revenue ?? '',
      target_affiliates: kpi.target_affiliates ?? '',
      notes: kpi.notes || '',
    })
    setKpiDialogOpen(true)
  }

  const deleteKpi = async (kpiId) => {
    const { error } = await supabase.from('staff_kpis').delete().eq('id', kpiId)
    if (error) { toast.error(error.message); return }
    toast.success('KPI target removed')
    loadKpis()
  }

  const exportTeamCSV = () => {
    const headers = ['Name', 'Role', 'Status', 'Affiliates', 'Revenue', 'Start Date']
    const rows = filteredStaff.map(s => [
      `${s.first_name} ${s.last_name}`, s.role,
      s.is_active ? 'Active' : 'Inactive',
      affiliateCounts[s.id] || 0, revenueTotals[s.id] || 0,
      s.start_date ? new Date(s.start_date).toLocaleDateString() : ''
    ])
    const csv = '\uFEFF' + [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'staff.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  if (roleLoading) return <div className="space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-12 rounded-lg" />)}</div>

  if (!isAdmin) return (
    <div className="flex flex-col items-center justify-center py-24 text-center space-y-3">
      <ShieldAlert className="w-12 h-12 text-muted-foreground opacity-40" />
      <p className="text-lg font-semibold">Access Restricted</p>
      <p className="text-sm text-muted-foreground">Only Admins can view Staff Management.</p>
    </div>
  )

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-outfit font-bold">Staff Management</h1>
          <p className="text-sm text-muted-foreground">{staff.length} staff members</p>
        </div>
        <div className="flex gap-2">
          {activeTab === 'team' && (
            <Button variant="outline" size="sm" onClick={exportTeamCSV}>
              <Download className="w-4 h-4 mr-1" /> Export CSV
            </Button>
          )}
          {activeTab === 'kpis' && (
            <Button size="sm" onClick={() => openAddKpi()}>
              <Plus className="w-4 h-4 mr-1" /> Set KPI Target
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-border">
        {[
          { id: 'team', label: 'Team', icon: Users },
          { id: 'kpis', label: 'KPI Targets', icon: Target },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === tab.id
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/40'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── TEAM TAB ─────────────────────────────────────────────────── */}
      {activeTab === 'team' && <>
        {loadingTeam ? (
          <div className="space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-12 rounded-lg" />)}</div>
        ) : (
          <Card>
            <CardContent className="pt-4">
              <div className="flex flex-wrap gap-2 mb-4">
                <div className="relative flex-1 min-w-[180px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input placeholder="Search staff..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
                </div>
                <div className="flex border rounded-lg overflow-hidden">
                  {['all','ADMIN','STAFF','VIEWER'].map(r => (
                    <button key={r} onClick={() => setRoleFilter(r)}
                      className={`px-3 py-2 text-sm font-medium transition-colors ${roleFilter === r ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}>
                      {r === 'all' ? 'All Roles' : r}
                    </button>
                  ))}
                </div>
                <div className="flex border rounded-lg overflow-hidden">
                  {[['all','All'],['active','Active'],['inactive','Inactive']].map(([v,l]) => (
                    <button key={v} onClick={() => setStatusFilter(v)}
                      className={`px-3 py-2 text-sm font-medium transition-colors ${statusFilter === v ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-lg border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>Name</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Affiliates</TableHead>
                      <TableHead>Revenue Generated</TableHead>
                      <TableHead>Start Date</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredStaff.length === 0 ? (
                      <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                        <UserCog className="w-8 h-8 mx-auto mb-2 opacity-30" />No staff members found.
                      </TableCell></TableRow>
                    ) : filteredStaff.map(s => (
                      <TableRow key={s.id} className="hover:bg-muted/30 transition-colors">
                        <TableCell className="font-medium">{s.first_name} {s.last_name}</TableCell>
                        <TableCell><Badge variant="outline" className="text-xs">{s.role}</Badge></TableCell>
                        <TableCell>
                          <Badge className={s.is_active ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}>
                            {s.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium">{affiliateCounts[s.id] || 0}</TableCell>
                        <TableCell className="font-medium text-green-600">${(revenueTotals[s.id] || 0).toLocaleString()}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">{s.start_date ? new Date(s.start_date).toLocaleDateString() : '-'}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-primary"
                              title="Set KPI Target"
                              onClick={() => { setActiveTab('kpis'); openAddKpi(s) }}>
                              <Target className="w-3.5 h-3.5" />
                            </Button>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-500 hover:text-red-600 hover:bg-red-50"
                              onClick={() => setDeleteTarget(s)}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}
      </>}

      {/* ── KPI TARGETS TAB ──────────────────────────────────────────── */}
      {activeTab === 'kpis' && <>
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <Select value={kpiYear} onValueChange={setKpiYear}>
            <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
            <SelectContent>{YEARS.map(y => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={kpiStaffFilter} onValueChange={setKpiStaffFilter}>
            <SelectTrigger className="w-48"><SelectValue placeholder="All staff" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Staff</SelectItem>
              {staff.map(s => (
                <SelectItem key={s.id} value={s.id}>
                  {s.first_name} {s.last_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {loadingKpi ? (
          <div className="space-y-3">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-12 rounded-lg" />)}</div>
        ) : (
          <Card>
            <CardContent className="pt-4">
              {kpiRows.length === 0 ? (
                <div className="text-center py-14 text-muted-foreground">
                  <Target className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p className="font-medium">No staff members found</p>
                </div>
              ) : (
                <div className="rounded-lg border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead>Staff Member</TableHead>
                        <TableHead>Period</TableHead>
                        <TableHead>Revenue Target</TableHead>
                        <TableHead>Actual Revenue</TableHead>
                        <TableHead>Rev Progress</TableHead>
                        <TableHead>Affiliates Target</TableHead>
                        <TableHead>Actual Affiliates</TableHead>
                        <TableHead>Aff Progress</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {kpiRows.map((row, idx) => {
                        if (row.isPlaceholder) {
                          return (
                            <TableRow key={`${row.staff.id}-placeholder`} className="hover:bg-muted/20">
                              <TableCell className="font-medium">
                                <div>
                                  <p className="text-sm font-semibold">{row.staff.first_name} {row.staff.last_name}</p>
                                  <p className="text-xs text-muted-foreground">{row.staff.role}</p>
                                </div>
                              </TableCell>
                              <TableCell colSpan={7} className="text-xs text-muted-foreground italic">
                                No KPI targets set for {kpiYear}
                              </TableCell>
                              <TableCell>
                                <Button variant="ghost" size="sm" className="h-7 text-xs gap-1"
                                  onClick={() => openAddKpi(row.staff)}>
                                  <Plus className="w-3 h-3" /> Set Target
                                </Button>
                              </TableCell>
                            </TableRow>
                          )
                        }

                        const kpi = row.kpi
                        const month = kpi.month || null
                        const actualRev = getActualRevenue(row.staff.id, month)
                        const actualAff = getActualAffiliates(row.staff.id, month)
                        const revTarget = Number(kpi.target_revenue || 0)
                        const affTarget = Number(kpi.target_affiliates || 0)
                        const revPct = revTarget > 0 ? Math.round((actualRev / revTarget) * 100) : null
                        const affPct = affTarget > 0 ? Math.round((actualAff / affTarget) * 100) : null
                        const periodLabel = month ? `${MONTHS[month]} ${kpi.year}` : `Full Year ${kpi.year}`

                        return (
                          <TableRow key={kpi.id} className="hover:bg-muted/20">
                            {row.isFirst && (
                              <TableCell rowSpan={row.rowspan} className="font-medium align-top pt-4 border-r">
                                <div>
                                  <p className="text-sm font-semibold">{row.staff.first_name} {row.staff.last_name}</p>
                                  <p className="text-xs text-muted-foreground">{row.staff.role}</p>
                                </div>
                              </TableCell>
                            )}
                            <TableCell>
                              <Badge variant="outline" className="text-xs font-normal whitespace-nowrap">
                                {periodLabel}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm">
                              {revTarget > 0 ? `$${revTarget.toLocaleString()}` : <span className="text-muted-foreground text-xs italic">Not set</span>}
                            </TableCell>
                            <TableCell className="text-sm font-medium text-green-600">
                              ${actualRev.toLocaleString()}
                            </TableCell>
                            <TableCell>
                              {revPct !== null ? (
                                <div className="flex items-center gap-2">
                                  <Progress value={Math.min(revPct, 100)} className="h-1.5 w-16" />
                                  <PctBadge pct={revPct} />
                                </div>
                              ) : <span className="text-xs text-muted-foreground">—</span>}
                            </TableCell>
                            <TableCell className="text-sm">
                              {affTarget > 0 ? affTarget : <span className="text-muted-foreground text-xs italic">Not set</span>}
                            </TableCell>
                            <TableCell className="text-sm font-medium">{actualAff}</TableCell>
                            <TableCell>
                              {affPct !== null ? (
                                <div className="flex items-center gap-2">
                                  <Progress value={Math.min(affPct, 100)} className="h-1.5 w-16" />
                                  <PctBadge pct={affPct} />
                                </div>
                              ) : <span className="text-xs text-muted-foreground">—</span>}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <Button variant="ghost" size="sm" className="h-7 w-7 p-0"
                                  onClick={() => openEditKpi(kpi)}>
                                  <Pencil className="w-3.5 h-3.5" />
                                </Button>
                                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-500 hover:text-red-600 hover:bg-red-50"
                                  onClick={() => deleteKpi(kpi.id)}>
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </>}

      {/* ── KPI Dialog ───────────────────────────────────────────────── */}
      <Dialog open={kpiDialogOpen} onOpenChange={v => { if (!v) { setKpiDialogOpen(false); setEditingKpi(null); setKpiForm(EMPTY_KPI_FORM) } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Target className="w-4 h-4" />
              {editingKpi ? 'Edit KPI Target' : 'Set KPI Target'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-1">
            {/* Staff member */}
            <div className="space-y-1.5">
              <Label>Staff Member</Label>
              <Select value={kpiForm.staff_member_id} onValueChange={v => setKpiForm(f => ({ ...f, staff_member_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Select staff member" /></SelectTrigger>
                <SelectContent>
                  {staff.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.first_name} {s.last_name} — {s.role}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Period */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Month <span className="text-muted-foreground text-xs">(leave blank for yearly)</span></Label>
                <Select value={kpiForm.month?.toString() || '0'} onValueChange={v => setKpiForm(f => ({ ...f, month: v === '0' ? '' : v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">Full Year</SelectItem>
                    {MONTHS.slice(1).map((m, i) => (
                      <SelectItem key={i + 1} value={(i + 1).toString()}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Year</Label>
                <Select value={kpiForm.year.toString()} onValueChange={v => setKpiForm(f => ({ ...f, year: parseInt(v) }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{YEARS.map(y => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>

            {/* Targets */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1"><DollarSign className="w-3.5 h-3.5" /> Revenue Target ($)</Label>
                <Input value={kpiForm.target_revenue} onChange={e => setKpiForm(f => ({ ...f, target_revenue: e.target.value }))}
                  placeholder="e.g. 50000" type="number" min="0" />
              </div>
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1"><TrendingUp className="w-3.5 h-3.5" /> Affiliates/IBs Target</Label>
                <Input value={kpiForm.target_affiliates} onChange={e => setKpiForm(f => ({ ...f, target_affiliates: e.target.value }))}
                  placeholder="e.g. 5" type="number" min="0" />
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <Label>Notes <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Input value={kpiForm.notes} onChange={e => setKpiForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="e.g. Q1 stretch target" />
            </div>

            <p className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
              Actuals are calculated live from commission records and affiliate sign-ups. If a target already exists for this staff member + period it will be overwritten.
            </p>

            <div className="flex gap-2 justify-end pt-1">
              <Button variant="outline" onClick={() => { setKpiDialogOpen(false); setEditingKpi(null); setKpiForm(EMPTY_KPI_FORM) }}>Cancel</Button>
              <Button onClick={saveKpi} disabled={savingKpi}>{savingKpi ? 'Saving…' : 'Save Target'}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Delete staff dialog ──────────────────────────────────────── */}
      <AlertDialog open={!!deleteTarget} onOpenChange={o => { if (!o) setDeleteTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete &ldquo;{[deleteTarget?.first_name, deleteTarget?.last_name].filter(Boolean).join(' ') || 'this staff member'}&rdquo;?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove their account, login access, and unassign their affiliates.
              <br /><strong className="text-destructive">This cannot be undone.</strong>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={deleteUser} disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting ? 'Deleting...' : 'Delete Staff Member'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
