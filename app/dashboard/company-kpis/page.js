'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Progress } from '@/components/ui/progress'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { BarChart3, Plus, Target, TrendingUp, Download, Users } from 'lucide-react'

const MONTHS = ['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

const EMPTY_FORM = {
  month: new Date().getMonth() + 1,
  year: new Date().getFullYear(),
  quarter: null,
  target_revenue: '',
  target_affiliates: '',
  target_commissions: '',
}

function AchievementPct({ pct }) {
  const colour = pct >= 80 ? 'text-green-600' : pct >= 50 ? 'text-yellow-500' : 'text-red-500'
  return <span className={`text-2xl font-outfit font-bold ${colour}`}>{pct}%</span>
}

export default function CompanyKPIsPage() {
  const [kpis, setKpis] = useState([])
  const [commissions, setCommissions] = useState([])
  const [affiliates, setAffiliates] = useState([])
  const [yearFilter, setYearFilter] = useState(new Date().getFullYear().toString())
  const [loading, setLoading] = useState(true)
  const [addOpen, setAddOpen] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [profile, setProfile] = useState(null)
  const supabase = createClient()

  useEffect(() => { load() }, [yearFilter])

  const load = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: prof } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      setProfile(prof)
    }
    const yr = parseInt(yearFilter)
    const [kpiRes, commRes, affRes] = await Promise.all([
      supabase.from('company_kpis').select('*').eq('year', yr).order('month'),
      supabase.from('commissions').select('month, year, revenue_amount, status').eq('year', yr),
      supabase.from('affiliates').select('id, status, created_at'),
    ])
    setKpis(kpiRes.data || [])
    setCommissions(commRes.data || [])
    setAffiliates(affRes.data || [])
    setLoading(false)
  }

  // Actual revenue from commissions for a given month
  const getActualRevenue = (month) =>
    commissions.filter(c => c.month === month).reduce((s, c) => s + Number(c.revenue_amount || 0), 0)

  // Count affiliates created in a given month of the selected year
  const getActualAffiliatesForMonth = (month) => {
    const yr = parseInt(yearFilter)
    return affiliates.filter(a => {
      if (!a.created_at) return false
      const d = new Date(a.created_at)
      return d.getFullYear() === yr && d.getMonth() + 1 === month
    }).length
  }

  // Count affiliates created in the selected year (for summary card)
  const getActualAffiliatesForYear = () => {
    const yr = parseInt(yearFilter)
    return affiliates.filter(a => {
      if (!a.created_at) return false
      return new Date(a.created_at).getFullYear() === yr
    }).length
  }

  const handleSave = async () => {
    if (!form.month || !form.year) { toast.error('Month and year are required'); return }
    setSaving(true)
    const existing = kpis.find(k => k.month === parseInt(form.month) && k.year === parseInt(form.year))
    const payload = {
      month: parseInt(form.month),
      year: parseInt(form.year),
      target_revenue: form.target_revenue ? parseFloat(form.target_revenue) : null,
      target_affiliates: form.target_affiliates ? parseInt(form.target_affiliates) : null,
      target_commissions: form.target_commissions ? parseInt(form.target_commissions) : null,
    }
    let error
    if (existing) {
      ({ error } = await supabase.from('company_kpis').update(payload).eq('id', existing.id))
    } else {
      ({ error } = await supabase.from('company_kpis').insert(payload))
    }
    if (error) { toast.error(error.message); setSaving(false); return }
    toast.success(existing ? 'KPI target updated' : 'KPI target set')
    setAddOpen(false)
    setForm(EMPTY_FORM)
    setSaving(false)
    load()
  }

  const exportCSV = () => {
    const headers = ['Month', 'Year', 'Target Revenue', 'Actual Revenue', 'Revenue Progress %', 'New Affiliates/IBs Target', 'Actual Affiliates/IBs', 'Affiliate Progress %']
    const rows = kpis.map(k => {
      const actual = getActualRevenue(k.month)
      const revPct = k.target_revenue ? Math.round((actual / k.target_revenue) * 100) : 0
      const affActual = getActualAffiliatesForMonth(k.month)
      const affPct = k.target_affiliates ? Math.round((affActual / k.target_affiliates) * 100) : 0
      return [MONTHS[k.month], k.year, k.target_revenue || 0, actual, `${revPct}%`, k.target_affiliates || 0, affActual, `${affPct}%`]
    })
    const csv = '\uFEFF' + [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'company-kpis.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  const isAdmin = profile?.role === 'ADMIN'
  const totalTarget = kpis.reduce((s, k) => s + Number(k.target_revenue || 0), 0)
  const totalActual = commissions.reduce((s, c) => s + Number(c.revenue_amount || 0), 0)
  const revenueAchievement = totalTarget > 0 ? Math.round((totalActual / totalTarget) * 100) : 0
  const totalAffiliatesTarget = kpis.reduce((s, k) => s + Number(k.target_affiliates || 0), 0)
  const totalAffiliatesActual = getActualAffiliatesForYear()
  const affiliateAchievement = totalAffiliatesTarget > 0 ? Math.round((totalAffiliatesActual / totalAffiliatesTarget) * 100) : 0

  if (loading) return <div className="space-y-3">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-14 rounded-lg" />)}</div>

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-outfit font-bold">Company KPIs</h1>
          <p className="text-sm text-muted-foreground">Track monthly KPI targets for revenue and new affiliates</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={yearFilter} onValueChange={setYearFilter}>
            <SelectTrigger className="w-24 rounded-lg border"><SelectValue /></SelectTrigger>
            <SelectContent>{[2023,2024,2025,2026].map(y => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}</SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={exportCSV}>
            <Download className="w-4 h-4 mr-1" /> Export
          </Button>
          {isAdmin && (
            <Button size="sm" onClick={() => setAddOpen(true)}>
              <Plus className="w-4 h-4 mr-1" /> Add Year
            </Button>
          )}
        </div>
      </div>

      {/* 4 Summary Cards — matching screenshot */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-5 pb-5">
            <p className="text-sm text-muted-foreground mb-2 flex items-center gap-1.5">
              <Target className="w-4 h-4" /> Annual Revenue Target
            </p>
            <p className="text-2xl font-outfit font-bold">${totalTarget.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
            <p className="text-xs text-muted-foreground mt-1">Actual: ${totalActual.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-5">
            <p className="text-sm text-muted-foreground mb-2 flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4" /> Revenue Achievement
            </p>
            <AchievementPct pct={revenueAchievement} />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-5">
            <p className="text-sm text-muted-foreground mb-2 flex items-center gap-1.5">
              <Users className="w-4 h-4" /> New Affiliates Target
            </p>
            <p className="text-2xl font-outfit font-bold">{totalAffiliatesTarget}</p>
            <p className="text-xs text-muted-foreground mt-1">Actual: {totalAffiliatesActual}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-5">
            <p className="text-sm text-muted-foreground mb-2 flex items-center gap-1.5">
              <BarChart3 className="w-4 h-4" /> Affiliate Achievement
            </p>
            <AchievementPct pct={affiliateAchievement} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="pt-4">
          {kpis.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <BarChart3 className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No KPI targets set for {yearFilter}</p>
              <p className="text-sm mt-1">Click &ldquo;Add Year&rdquo; to define monthly targets</p>
            </div>
          ) : (
            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Month</TableHead>
                    <TableHead>Target Revenue</TableHead>
                    <TableHead>Actual Revenue</TableHead>
                    <TableHead>Progress</TableHead>
                    <TableHead>New Affiliates/IBs</TableHead>
                    <TableHead>Actual Affiliates/IBs</TableHead>
                    <TableHead>Progress</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {kpis.map(k => {
                    const actual = getActualRevenue(k.month)
                    const target = Number(k.target_revenue || 0)
                    const revProg = target > 0 ? Math.round((actual / target) * 100) : 0
                    const affTarget = Number(k.target_affiliates || 0)
                    const affActual = getActualAffiliatesForMonth(k.month)
                    const affProg = affTarget > 0 ? Math.round((affActual / affTarget) * 100) : 0
                    return (
                      <TableRow key={k.id} className="hover:bg-muted/30">
                        <TableCell className="font-medium">{MONTHS[k.month]}</TableCell>
                        <TableCell>${target.toLocaleString()}</TableCell>
                        <TableCell className="text-green-600 font-medium">${actual.toLocaleString()}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Progress value={Math.min(revProg, 100)} className="h-2 w-20" />
                            <span className={`text-xs font-medium ${
                              revProg >= 100 ? 'text-green-600' : revProg >= 80 ? 'text-yellow-600' : 'text-red-500'
                            }`}>{revProg}%</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {affTarget > 0 ? affTarget : <span className="text-xs italic opacity-60">Not set</span>}
                        </TableCell>
                        <TableCell className="font-medium">{affActual}</TableCell>
                        <TableCell>
                          {affTarget > 0 ? (
                            <div className="flex items-center gap-2">
                              <Progress value={Math.min(affProg, 100)} className="h-2 w-20" />
                              <span className={`text-xs font-medium ${
                                affProg >= 100 ? 'text-green-600' : affProg >= 50 ? 'text-yellow-600' : 'text-red-500'
                              }`}>{affProg}%</span>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
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

      {/* Set Target Modal */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Target className="w-4 h-4" /> Set KPI Target</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Month</Label>
                <Select value={form.month.toString()} onValueChange={v => setForm(f => ({...f, month: parseInt(v)}))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{MONTHS.slice(1).map((m, i) => <SelectItem key={i+1} value={(i+1).toString()}>{m}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Year</Label>
                <Select value={form.year.toString()} onValueChange={v => setForm(f => ({...f, year: parseInt(v)}))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{[2023,2024,2025,2026].map(y => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Target Revenue ($)</Label>
              <Input value={form.target_revenue} onChange={e => setForm(f => ({...f, target_revenue: e.target.value}))} placeholder="e.g. 50000" type="number" min="0" />
            </div>
            <div className="space-y-1.5">
              <Label>New Affiliates/IBs Target</Label>
              <Input value={form.target_affiliates} onChange={e => setForm(f => ({...f, target_affiliates: e.target.value}))} placeholder="e.g. 5" type="number" min="0" />
            </div>
            <p className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">Actual revenue is calculated from commission records. Actual affiliates/IBs counts new sign-ups that month. If a target exists for this month/year, it will be updated.</p>
            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
              <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save Target'}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
