'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Users, Building2, DollarSign, Clock, TrendingUp, ArrowUpRight, Plus, Settings, Trash2, LayoutDashboard, Calendar, UserCheck } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import Link from 'next/link'
import { toast } from 'sonner'
import { useUserRole } from '@/lib/hooks/useUserRole'

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

const WIDGET_DEFS = [
  { id: 'overview_stats', label: 'Overview Stats', description: 'Key metric cards (affiliates, brokers, revenue)' },
  { id: 'monthly_chart', label: 'Monthly Revenue Chart', description: 'Bar chart showing revenue by month' },
  { id: 'top_affiliates', label: 'Top Affiliates', description: 'Top 5 affiliates by total revenue' },
  { id: 'onboarding_affiliates', label: 'Affiliates/IBs in Onboarding', description: 'All affiliates/IBs currently in the Onboarding stage' },
  { id: 'upcoming_appointments', label: 'Upcoming Appointments', description: 'Next 5 scheduled appointments' },
]

const DEFAULT_DASHBOARD = {
  id: 'main',
  name: 'Main Dashboard',
  locked: true,
  widgets: ['overview_stats', 'monthly_chart', 'top_affiliates', 'onboarding_affiliates', 'upcoming_appointments'],
}

function useDashboards(userId) {
  const [dashboards, setDashboards] = useState([DEFAULT_DASHBOARD])

  useEffect(() => {
    if (!userId) return
    try {
      const saved = localStorage.getItem(`dashboard_configs_${userId}`)
      if (saved) {
        const parsed = JSON.parse(saved)
        setDashboards([DEFAULT_DASHBOARD, ...parsed.filter(d => d.id !== 'main')])
      }
    } catch {}
  }, [userId])

  const save = useCallback((newList) => {
    const toStore = newList.filter(d => d.id !== 'main')
    if (userId) localStorage.setItem(`dashboard_configs_${userId}`, JSON.stringify(toStore))
    setDashboards([DEFAULT_DASHBOARD, ...toStore])
  }, [userId])

  return [dashboards, save]
}

export default function DashboardPage() {
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({})
  const [chartData, setChartData] = useState([])
  const [topAffiliates, setTopAffiliates] = useState([])
  const [onboardingAffiliates, setOnboardingAffiliates] = useState([])
  const [upcomingAppointments, setUpcomingAppointments] = useState([])
  const [yearFilter, setYearFilter] = useState(new Date().getFullYear().toString())
  const { userId, role, loading: roleLoading } = useUserRole()
  const isAdmin = role === 'ADMIN'
  const [dashboards, saveDashboards] = useDashboards(userId)
  const [activeDashboardId, setActiveDashboardId] = useState('main')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingDashboard, setEditingDashboard] = useState(null)
  const [draftName, setDraftName] = useState('')
  const [draftWidgets, setDraftWidgets] = useState([])
  const [deleteTarget, setDeleteTarget] = useState(null)
  const supabase = createClient()

  useEffect(() => {
    // Wait until we know who the user is and their role
    if (roleLoading || !userId || !role) return

    const load = async () => {
      setLoading(true)
      try {
        // Admin sees everything; staff sees only their own affiliates
        let affQuery = supabase.from('affiliates').select('id, name, status, renewal_date, broker_id, manager_id')
        if (!isAdmin) affQuery = affQuery.eq('manager_id', userId)

        const [affRes, brokerRes] = await Promise.all([
          affQuery,
          supabase.from('brokers').select('id, name, is_active'),
        ])

        const affiliates = affRes.data || []
        const brokers = brokerRes.data || []
        const affiliateIds = affiliates.map(a => a.id)

        // Fetch commissions scoped to relevant affiliates
        let commQuery = supabase.from('commissions').select('id, month, year, revenue_amount, status, affiliate_id')
        if (!isAdmin && affiliateIds.length > 0) commQuery = commQuery.in('affiliate_id', affiliateIds)
        else if (!isAdmin) commQuery = commQuery.eq('affiliate_id', 'none') // No affiliates = no commissions

        // Fetch upcoming appointments scoped to relevant affiliates
        let apptQuery = supabase.from('appointments')
          .select('id, title, affiliate_id, scheduled_at, appointment_type, status')
          .gte('scheduled_at', new Date().toISOString())
          .eq('status', 'SCHEDULED')
          .order('scheduled_at', { ascending: true })
          .limit(5)
        if (!isAdmin && affiliateIds.length > 0) apptQuery = apptQuery.in('affiliate_id', affiliateIds)
        else if (!isAdmin) apptQuery = apptQuery.eq('affiliate_id', 'none')

        const [commRes, apptRes] = await Promise.all([commQuery, apptQuery])

        const commissions = commRes.data || []
        const appointments = apptRes.data || []

        const totalRevenue = commissions.reduce((s, c) => s + Number(c.revenue_amount || 0), 0)
        const pendingRevenue = commissions
          .filter(c => c.status === 'PENDING' || c.status === 'AWAITED')
          .reduce((s, c) => s + Number(c.revenue_amount || 0), 0)
        const paidRevenue = commissions.filter(c => c.status === 'PAID').reduce((s, c) => s + Number(c.revenue_amount || 0), 0)

        setStats({
          totalAffiliates: affiliates.length,
          activeAffiliates: affiliates.filter(a => a.status === 'ACTIVE').length,
          totalBrokers: brokers.length,
          activeBrokers: brokers.filter(b => b.is_active).length,
          totalRevenue,
          pendingRevenue,
          paidRevenue,
          affiliateMap: Object.fromEntries(affiliates.map(a => [a.id, a.name])),
        })

        const yr = parseInt(yearFilter)
        const monthlyData = MONTHS.map((name, i) => {
          const monthComm = commissions.filter(c => {
            const cYear = typeof c.year === 'string' ? parseInt(c.year) : c.year
            const cMonth = typeof c.month === 'string' ? parseInt(c.month) : c.month
            return cYear === yr && cMonth === i + 1
          })
          return {
            name,
            revenue: monthComm.reduce((s, c) => s + Number(c.revenue_amount || 0), 0),
          }
        })
        setChartData(monthlyData)

        const affRevenue = {}
        commissions.forEach(c => {
          affRevenue[c.affiliate_id] = (affRevenue[c.affiliate_id] || 0) + Number(c.revenue_amount || 0)
        })
        const top = Object.entries(affRevenue)
          .sort(([,a], [,b]) => b - a)
          .slice(0, 5)
          .map(([id, revenue]) => {
            const aff = affiliates.find(a => a.id === id)
            return { id, name: aff?.name || 'Unknown', revenue, status: aff?.status || 'N/A' }
          })
        setTopAffiliates(top)

        // Onboarding affiliates for widget — fetch with broker name
        let onbQuery = supabase
          .from('affiliates')
          .select('id, name, email, deal_type, created_at, broker:brokers(name)')
          .eq('status', 'ONBOARDING')
          .order('created_at', { ascending: false })
        if (!isAdmin) onbQuery = onbQuery.eq('manager_id', userId)
        const onbRes = await onbQuery
        setOnboardingAffiliates(onbRes.data || [])

        setUpcomingAppointments(appointments)
      } catch (err) {
        console.error('Dashboard load error:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [yearFilter, roleLoading, userId, role])

  const fmt = (n) => `$${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`

  const activeDashboard = dashboards.find(d => d.id === activeDashboardId) || dashboards[0]
  const show = (widgetId) => activeDashboard?.widgets?.includes(widgetId)

  // Modal helpers
  const openCreate = () => {
    setEditingDashboard(null)
    setDraftName('')
    setDraftWidgets(['overview_stats', 'monthly_chart', 'top_affiliates'])
    setModalOpen(true)
  }
  const openEdit = (d) => {
    setEditingDashboard(d)
    setDraftName(d.name)
    setDraftWidgets([...d.widgets])
    setModalOpen(true)
  }
  const saveDashboard = () => {
    if (!draftName.trim()) { toast.error('Dashboard name is required'); return }
    if (draftWidgets.length === 0) { toast.error('Select at least one widget'); return }
    if (editingDashboard) {
      saveDashboards(dashboards.map(d => d.id === editingDashboard.id ? { ...d, name: draftName.trim(), widgets: draftWidgets } : d))
      toast.success('Dashboard updated')
    } else {
      const newD = { id: `dash_${Date.now()}`, name: draftName.trim(), widgets: draftWidgets }
      saveDashboards([...dashboards, newD])
      setActiveDashboardId(newD.id)
      toast.success('Dashboard created')
    }
    setModalOpen(false)
  }
  const deleteDashboard = (d) => {
    saveDashboards(dashboards.filter(x => x.id !== d.id))
    if (activeDashboardId === d.id) setActiveDashboardId('main')
    setDeleteTarget(null)
    toast.success('Dashboard deleted')
  }

  const statCards = isAdmin
    ? [
        { label: 'Total Affiliates', value: stats.totalAffiliates, sub: `${stats.activeAffiliates ?? 0} active`, icon: Users, iconColor: 'text-blue-500', bgColor: 'bg-blue-50' },
        { label: 'Total Brokers', value: stats.totalBrokers, sub: `${stats.activeBrokers ?? 0} active`, icon: Building2, iconColor: 'text-purple-500', bgColor: 'bg-purple-50' },
        { label: 'Total Revenue', value: fmt(stats.totalRevenue), sub: 'All time', icon: DollarSign, iconColor: 'text-blue-500', bgColor: 'bg-blue-50' },
        { label: 'Pending Revenue', value: fmt(stats.pendingRevenue), sub: 'Pending & Awaited', icon: Clock, iconColor: 'text-yellow-500', bgColor: 'bg-yellow-50' },
        { label: 'Paid Revenue', value: fmt(stats.paidRevenue), sub: 'Confirmed', icon: TrendingUp, iconColor: 'text-green-500', bgColor: 'bg-green-50' },
        { label: 'In Onboarding', value: onboardingAffiliates.length, sub: 'Affiliates/IBs', icon: UserCheck, iconColor: 'text-blue-500', bgColor: 'bg-blue-50' },
      ]
    : [
        { label: 'My Affiliates', value: stats.totalAffiliates, sub: `${stats.activeAffiliates ?? 0} active`, icon: Users, iconColor: 'text-blue-500', bgColor: 'bg-blue-50' },
        { label: 'My Revenue', value: fmt(stats.totalRevenue), sub: 'All time', icon: DollarSign, iconColor: 'text-blue-500', bgColor: 'bg-blue-50' },
        { label: 'Pending Revenue', value: fmt(stats.pendingRevenue), sub: 'Pending & Awaited', icon: Clock, iconColor: 'text-yellow-500', bgColor: 'bg-yellow-50' },
        { label: 'Paid Revenue', value: fmt(stats.paidRevenue), sub: 'Confirmed', icon: TrendingUp, iconColor: 'text-green-500', bgColor: 'bg-green-50' },
        { label: 'In Onboarding', value: onboardingAffiliates.length, sub: 'Affiliates/IBs', icon: UserCheck, iconColor: 'text-blue-500', bgColor: 'bg-blue-50' },
      ]

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
        <Skeleton className="h-80 rounded-xl" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header + Dashboard Tabs */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-outfit font-bold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            {isAdmin ? 'Overview of your affiliate business' : 'Your performance overview'}
          </p>
        </div>
        {isAdmin && (
          <Button size="sm" onClick={openCreate} className="shrink-0">
            <Plus className="w-4 h-4 mr-1" /> New Dashboard
          </Button>
        )}
      </div>

      {/* Dashboard Tabs — admin only */}
      {isAdmin && dashboards.length > 1 && (
        <div className="flex items-center gap-1 overflow-x-auto pb-1">
          {dashboards.map(d => (
            <div key={d.id} className={`flex items-center gap-1 rounded-lg border transition-colors shrink-0 ${activeDashboardId === d.id ? 'bg-primary text-primary-foreground border-primary' : 'bg-card hover:bg-muted border-border'}`}>
              <button
                onClick={() => setActiveDashboardId(d.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium"
              >
                <LayoutDashboard className="w-3.5 h-3.5" />
                {d.name}
              </button>
              {!d.locked && (
                <div className="flex items-center pr-1 gap-0.5">
                  <button onClick={() => openEdit(d)} className={`p-1 rounded hover:bg-white/20 transition-colors ${activeDashboardId === d.id ? 'text-primary-foreground/70 hover:text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
                    <Settings className="w-3 h-3" />
                  </button>
                  <button onClick={() => setDeleteTarget(d)} className={`p-1 rounded hover:bg-white/20 transition-colors ${activeDashboardId === d.id ? 'text-primary-foreground/70 hover:text-primary-foreground' : 'text-muted-foreground hover:text-red-500'}`}>
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Overview Stats */}
      {show('overview_stats') && (
        <div className={`grid gap-4 ${isAdmin ? 'grid-cols-2 lg:grid-cols-3 xl:grid-cols-6' : 'grid-cols-2 lg:grid-cols-3 xl:grid-cols-5'}`}>
          {statCards.map((card, i) => (
            <Card key={i} className="hover:shadow-md transition-shadow">
              <CardContent className="pt-4 pb-4 px-4">
                <div className={`w-8 h-8 rounded-lg ${card.bgColor} flex items-center justify-center mb-3`}>
                  <card.icon className={`w-4 h-4 ${card.iconColor}`} />
                </div>
                <p className="text-2xl font-outfit font-bold">{card.value ?? 0}</p>
                <p className="text-xs font-medium text-foreground mt-0.5">{card.label}</p>
                <p className="text-xs text-muted-foreground">{card.sub}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Revenue Chart */}
      {show('monthly_chart') && (
        <Card>
          <CardHeader className="flex-row items-center justify-between pb-2">
            <CardTitle className="text-base">Monthly Revenue</CardTitle>
            <Select value={yearFilter} onValueChange={setYearFilter}>
              <SelectTrigger className="w-24 h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {[2023, 2024, 2025, 2026].map(y => (
                  <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
                  <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} tickFormatter={v => `$${v >= 1000 ? (v/1000).toFixed(0)+'k' : v}`} />
                  <Tooltip
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }}
                    formatter={(val) => [`$${Number(val).toLocaleString()}`, '']}
                  />
                  <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Revenue" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid lg:grid-cols-2 gap-5">
        {/* Top Affiliates */}
        {show('top_affiliates') && (
          <Card>
            <CardHeader className="flex-row items-center justify-between pb-2">
              <CardTitle className="text-base">Top Affiliates by Revenue</CardTitle>
              <Link href="/dashboard/affiliates">
                <Button variant="ghost" size="sm" className="h-7 text-xs">View all <ArrowUpRight className="w-3 h-3 ml-1" /></Button>
              </Link>
            </CardHeader>
            <CardContent>
              {topAffiliates.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">No revenue data yet.</p>
              ) : (
                <div className="space-y-2">
                  {topAffiliates.map((a, i) => (
                    <div key={a.id} className="flex items-center justify-between py-2 border-b last:border-0">
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium text-muted-foreground w-5">{i + 1}</span>
                        <div>
                          <p className="font-medium text-sm">{a.name}</p>
                          <Badge variant="outline" className="text-xs mt-0.5">{a.status}</Badge>
                        </div>
                      </div>
                      <span className="font-outfit font-semibold text-green-600 text-sm">{fmt(a.revenue)}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Affiliates/IBs in Onboarding */}
        {show('onboarding_affiliates') && (
          <Card>
            <CardHeader className="flex-row items-center justify-between pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-blue-500" /> Affiliates/IBs in Onboarding
              </CardTitle>
              <Link href="/dashboard/affiliates?status=ONBOARDING">
                <Button variant="ghost" size="sm" className="h-7 text-xs">View all <ArrowUpRight className="w-3 h-3 ml-1" /></Button>
              </Link>
            </CardHeader>
            <CardContent>
              {onboardingAffiliates.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">No affiliates/IBs currently in onboarding.</p>
              ) : (
                <div className="space-y-2">
                  {onboardingAffiliates.slice(0, 5).map(a => (
                    <div key={a.id} className="flex items-center justify-between py-2 border-b last:border-0">
                      <div>
                        <p className="font-medium text-sm">{a.name}</p>
                        <p className="text-xs text-muted-foreground">{a.broker?.name || '—'}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {a.deal_type && (
                          <Badge variant="outline" className="text-xs">{a.deal_type}</Badge>
                        )}
                        <span className="text-xs text-muted-foreground">
                          {new Date(a.created_at).toLocaleDateString('en', { month: 'short', day: 'numeric' })}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Upcoming Appointments */}
        {show('upcoming_appointments') && (
          <Card className={!show('top_affiliates') && !show('onboarding_affiliates') ? 'lg:col-span-2' : ''}>
            <CardHeader className="flex-row items-center justify-between pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Calendar className="w-4 h-4 text-blue-500" /> Upcoming Appointments
              </CardTitle>
              <Link href="/dashboard/appointments">
                <Button variant="ghost" size="sm" className="h-7 text-xs">View all <ArrowUpRight className="w-3 h-3 ml-1" /></Button>
              </Link>
            </CardHeader>
            <CardContent>
              {upcomingAppointments.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">No upcoming appointments scheduled.</p>
              ) : (
                <div className="space-y-2">
                  {upcomingAppointments.map(a => (
                    <div key={a.id} className="flex items-center justify-between py-2 border-b last:border-0">
                      <div>
                        <p className="font-medium text-sm">{a.title}</p>
                        <p className="text-xs text-muted-foreground">{stats.affiliateMap?.[a.affiliate_id] || 'Unknown affiliate'}</p>
                      </div>
                      <Badge className="bg-blue-50 text-blue-700 border-blue-200 text-xs shrink-0">
                        {new Date(a.scheduled_at).toLocaleString('en', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Empty state if no widgets selected */}
      {!show('overview_stats') && !show('monthly_chart') && !show('top_affiliates') && !show('onboarding_affiliates') && !show('upcoming_appointments') && (
        <div className="text-center py-20 text-muted-foreground space-y-3">
          <LayoutDashboard className="w-12 h-12 mx-auto opacity-20" />
          <p className="font-medium">No widgets selected for this dashboard</p>
          <Button variant="outline" size="sm" onClick={() => openEdit(activeDashboard)}>
            <Settings className="w-4 h-4 mr-1" /> Configure Dashboard
          </Button>
        </div>
      )}

      {/* Create / Edit Dashboard Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <LayoutDashboard className="w-4 h-4" />
              {editingDashboard ? 'Edit Dashboard' : 'Create New Dashboard'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>Dashboard Name <span className="text-destructive">*</span></Label>
              <Input
                value={draftName}
                onChange={e => setDraftName(e.target.value)}
                placeholder="e.g. Sales Overview, Revenue Focus..."
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label>Widgets</Label>
              <p className="text-xs text-muted-foreground -mt-1">Select which sections appear on this dashboard</p>
              <div className="space-y-2 rounded-lg border p-3">
                {WIDGET_DEFS.map(w => (
                  <div key={w.id} className="flex items-start gap-3 cursor-pointer" onClick={() => setDraftWidgets(prev => prev.includes(w.id) ? prev.filter(x => x !== w.id) : [...prev, w.id])}>
                    <Checkbox checked={draftWidgets.includes(w.id)} className="mt-0.5" />
                    <div>
                      <p className="text-sm font-medium leading-none">{w.label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{w.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
              <Button onClick={saveDashboard}>{editingDashboard ? 'Save Changes' : 'Create Dashboard'}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete &ldquo;{deleteTarget?.name}&rdquo;?</AlertDialogTitle>
            <AlertDialogDescription>This dashboard will be permanently removed. Your data is not affected.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteDashboard(deleteTarget)} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
