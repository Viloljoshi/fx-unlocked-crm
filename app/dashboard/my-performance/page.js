'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts'
import { TrendingUp, Users, DollarSign, Target } from 'lucide-react'

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

export default function MyPerformancePage() {
  const [profile, setProfile] = useState(null)
  const [affiliates, setAffiliates] = useState([])
  const [commissions, setCommissions] = useState([])
  const [kpis, setKpis] = useState([])
  const [loading, setLoading] = useState(true)
  const [yearFilter, setYearFilter] = useState(new Date().getFullYear().toString())
  const supabase = createClient()

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }

      const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      setProfile(prof)

      // Fetch affiliates first so we can filter commissions to this user's portfolio
      const { data: myAffiliates } = await supabase.from('affiliates').select('*').eq('manager_id', user.id)
      setAffiliates(myAffiliates || [])

      const myAffiliateIds = (myAffiliates || []).map(a => a.id)

      const [commRes, kpiRes] = await Promise.all([
        myAffiliateIds.length > 0
          ? supabase.from('commissions').select('*').in('affiliate_id', myAffiliateIds)
          : Promise.resolve({ data: [] }),
        supabase.from('staff_kpis').select('*').eq('staff_member_id', user.id).order('year', { ascending: false }),
      ])
      setCommissions(commRes.data || [])
      setKpis(kpiRes.data || [])
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return <div className="space-y-4">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)}</div>

  const yr = parseInt(yearFilter)
  const totalRevenue = commissions.reduce((s, c) => s + Number(c.revenue_amount || 0), 0)
  
  // Fix: ensure type comparison works correctly (year from DB is number)
  const monthlyData = MONTHS.map((name, i) => {
    const mc = commissions.filter(c => {
      const cYear = typeof c.year === 'string' ? parseInt(c.year) : c.year
      const cMonth = typeof c.month === 'string' ? parseInt(c.month) : c.month
      return cYear === yr && cMonth === (i + 1)
    })
    return {
      name,
      revenue: mc.reduce((s, c) => s + Number(c.revenue_amount || 0), 0)
    }
  })

  const hasChartData = monthlyData.some(d => d.revenue > 0)

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-outfit font-bold">My Performance</h1>
          <p className="text-sm text-muted-foreground">Welcome back, {profile?.first_name || 'User'}</p>
        </div>
        <Select value={yearFilter} onValueChange={setYearFilter}>
          <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
          <SelectContent>{[2023,2024,2025,2026].map(y => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      {/* Stat Cards */}
      <div className="grid sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <Users className="w-4 h-4" /> My Affiliates
            </div>
            <p className="text-3xl font-outfit font-bold">{affiliates.length}</p>
            <p className="text-xs text-muted-foreground mt-1">{affiliates.filter(a => a.status === 'ACTIVE').length} active</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <DollarSign className="w-4 h-4" /> Total Revenue
            </div>
            <p className="text-3xl font-outfit font-bold text-green-600">${totalRevenue.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground mt-1">All time</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <Target className="w-4 h-4" /> This Year Commissions
            </div>
            <p className="text-3xl font-outfit font-bold">{commissions.filter(c => {
              const cYear = typeof c.year === 'string' ? parseInt(c.year) : c.year
              return cYear === yr
            }).length}</p>
            <p className="text-xs text-muted-foreground mt-1">In {yearFilter}</p>
          </CardContent>
        </Card>
      </div>

      {/* Revenue Chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Monthly Revenue — {yearFilter}</CardTitle>
        </CardHeader>
        <CardContent>
          {!hasChartData ? (
            <div className="h-56 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <TrendingUp className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No revenue data for {yearFilter}</p>
              </div>
            </div>
          ) : (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
                  <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} tickFormatter={v => `$${v.toLocaleString()}`} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                    formatter={val => [`$${Number(val).toLocaleString()}`, 'Revenue']}
                  />
                  <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* KPI Targets */}
      {kpis.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">My KPI Targets</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {kpis.slice(0, 5).map(kpi => {
              const revProgress = kpi.target_revenue ? Math.min(100, (kpi.actual_revenue / kpi.target_revenue) * 100) : 0
              const affProgress = kpi.target_affiliates ? Math.min(100, (kpi.actual_affiliates / kpi.target_affiliates) * 100) : 0
              return (
                <div key={kpi.id} className="p-4 rounded-lg bg-muted/30 border">
                  <div className="flex items-center gap-2 mb-3">
                    <Badge variant="outline" className="text-xs">
                      {kpi.year} {kpi.quarter ? `Q${kpi.quarter}` : ''} {kpi.month ? MONTHS[kpi.month - 1] : ''}
                    </Badge>
                  </div>
                  <div className="space-y-2">
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-muted-foreground">Revenue</span>
                        <span className="font-medium">${(kpi.actual_revenue || 0).toLocaleString()} / ${(kpi.target_revenue || 0).toLocaleString()}</span>
                      </div>
                      <Progress value={revProgress} className="h-1.5" />
                    </div>
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-muted-foreground">Affiliates</span>
                        <span className="font-medium">{kpi.actual_affiliates || 0} / {kpi.target_affiliates || 0}</span>
                      </div>
                      <Progress value={affProgress} className="h-1.5" />
                    </div>
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>
      )}

      {/* My Affiliates Table */}
      <Card>
        <CardHeader><CardTitle className="text-base">My Affiliates ({affiliates.length})</CardTitle></CardHeader>
        <CardContent>
          {affiliates.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No affiliates assigned to you yet</p>
            </div>
          ) : (
            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Deal Type</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {affiliates.map(a => (
                    <TableRow key={a.id} className="hover:bg-muted/30">
                      <TableCell className="font-medium">{a.name}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{a.email}</TableCell>
                      <TableCell><Badge variant="outline" className="text-xs">{a.status}</Badge></TableCell>
                      <TableCell><Badge variant="outline" className="text-xs">{a.deal_type}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
