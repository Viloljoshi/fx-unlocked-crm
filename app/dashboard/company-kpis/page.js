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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Progress } from '@/components/ui/progress'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { BarChart3, Plus, Target, TrendingUp, Download } from 'lucide-react'

const MONTHS = ['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

const EMPTY_FORM = {
  month: new Date().getMonth() + 1,
  year: new Date().getFullYear(),
  quarter: null,
  target_revenue: '',
  target_affiliates: '',
  target_commissions: '',
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

  // Calculate actuals from commissions for each month
  const getActualRevenue = (month) => {
    return commissions
      .filter(c => c.month === month)
      .reduce((s, c) => s + Number(c.revenue_amount || 0), 0)
  }

  const getActualAffiliates = () => {
    const yr = parseInt(yearFilter)
    return affiliates.filter(a => {
      if (!a.created_at) return false
      return new Date(a.created_at).getFullYear() === yr
    }).length
  }

  const handleSave = async () => {
    if (!form.month || !form.year) { toast.error('Month and year are required'); return }
    setSaving(true)
    // Check if KPI already exists for this month/year
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
    const headers = ['Month', 'Year', 'Target Revenue', 'Actual Revenue', 'Progress %', 'Target Affiliates', 'Target Commissions']
    const rows = kpis.map(k => {
      const actual = getActualRevenue(k.month)
      const pct = k.target_revenue ? Math.round((actual / k.target_revenue) * 100) : 0
      return [MONTHS[k.month], k.year, k.target_revenue || 0, actual, `${pct}%`, k.target_affiliates || 0, k.target_commissions || 0]
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
  const overallProgress = totalTarget > 0 ? Math.round((totalActual / totalTarget) * 100) : 0

  if (loading) return <div className="space-y-3">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-14 rounded-lg" />)}</div>

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-outfit font-bold">Company KPIs</h1>
          <p className="text-sm text-muted-foreground">Monthly targets vs actuals for {yearFilter}</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={yearFilter} onValueChange={setYearFilter}>
            <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
            <SelectContent>{[2023,2024,2025,2026].map(y => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}</SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={exportCSV}>
            <Download className="w-4 h-4 mr-1" /> Export
          </Button>
          {isAdmin && (
            <Button size="sm" onClick={() => setAddOpen(true)}>
              <Plus className="w-4 h-4 mr-1" /> Set Target
            </Button>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <Target className="w-4 h-4" /> Annual Target
            </div>
            <p className="text-2xl font-outfit font-bold">${totalTarget.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <TrendingUp className="w-4 h-4" /> Actual Revenue
            </div>
            <p className="text-2xl font-outfit font-bold text-green-600">${totalActual.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <BarChart3 className="w-4 h-4" /> Overall Progress
            </div>
            <p className="text-2xl font-outfit font-bold">{overallProgress}%</p>
            <Progress value={Math.min(overallProgress, 100)} className="h-1.5 mt-2" />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="pt-4">
          {kpis.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <BarChart3 className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No KPI targets set for {yearFilter}</p>
              <p className="text-sm mt-1">Click &ldquo;Set Target&rdquo; to define monthly revenue targets</p>
            </div>
          ) : (
            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Month</TableHead>
                    <TableHead>Revenue Target</TableHead>
                    <TableHead>Revenue Actual</TableHead>
                    <TableHead>Progress</TableHead>
                    <TableHead>Variance</TableHead>
                    <TableHead>Target Affiliates</TableHead>
                    <TableHead>Target Commissions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {kpis.map(k => {
                    const actual = getActualRevenue(k.month)
                    const target = Number(k.target_revenue || 0)
                    const revProg = target > 0 ? Math.round((actual / target) * 100) : 0
                    const variance = actual - target
                    return (
                      <TableRow key={k.id} className="hover:bg-muted/30">
                        <TableCell className="font-medium">{MONTHS[k.month]}</TableCell>
                        <TableCell>${target.toLocaleString()}</TableCell>
                        <TableCell className="text-green-600 font-medium">${actual.toLocaleString()}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Progress value={Math.min(revProg, 100)} className="h-2 w-24" />
                            <span className={`text-xs font-medium ${
                              revProg >= 100 ? 'text-green-600' : revProg >= 80 ? 'text-yellow-600' : 'text-red-500'
                            }`}>{revProg}%</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className={`text-sm font-medium ${
                            variance >= 0 ? 'text-green-600' : 'text-red-500'
                          }`}>
                            {variance >= 0 ? '+' : ''}${variance.toLocaleString()}
                          </span>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{k.target_affiliates != null ? k.target_affiliates : <span className="text-xs italic opacity-60">Not set</span>}</TableCell>
                        <TableCell className="text-muted-foreground">{k.target_commissions != null ? k.target_commissions : <span className="text-xs italic opacity-60">Not set</span>}</TableCell>
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
              <Label>Revenue Target ($)</Label>
              <Input value={form.target_revenue} onChange={e => setForm(f => ({...f, target_revenue: e.target.value}))} placeholder="e.g. 50000" type="number" min="0" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Target Affiliates</Label>
                <Input value={form.target_affiliates} onChange={e => setForm(f => ({...f, target_affiliates: e.target.value}))} placeholder="e.g. 10" type="number" min="0" />
              </div>
              <div className="space-y-1.5">
                <Label>Target Commissions</Label>
                <Input value={form.target_commissions} onChange={e => setForm(f => ({...f, target_commissions: e.target.value}))} placeholder="e.g. 20" type="number" min="0" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">Actual revenue is automatically calculated from commission records. If a target already exists for this month/year, it will be updated.</p>
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
