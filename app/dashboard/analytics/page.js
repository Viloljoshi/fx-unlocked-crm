'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Download } from 'lucide-react'
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts'

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const COLORS = ['hsl(var(--primary))', '#10B981', '#F59E0B', '#8B5CF6', '#EF4444', '#06B6D4']

export default function AnalyticsPage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [yearFilter, setYearFilter] = useState(new Date().getFullYear().toString())
  const supabase = createClient()

  useEffect(() => { load() }, [yearFilter])

  const load = async () => {
    setLoading(true)
    const yr = parseInt(yearFilter)
    const [commRes, affRes, apptRes, brkRes] = await Promise.all([
      supabase.from('commissions').select('*'),
      supabase.from('affiliates').select('*'),
      supabase.from('appointments').select('*'),
      supabase.from('brokers').select('id, name'),
    ])
    const commissions = commRes.data || []
    const affiliates = affRes.data || []
    const appointments = apptRes.data || []
    const brokers = brkRes.data || []

    // Revenue by month for selected year
    const revenueByMonth = MONTHS.map((name, i) => {
      const mc = commissions.filter(c => {
        const cy = typeof c.year === 'string' ? parseInt(c.year) : c.year
        const cm = typeof c.month === 'string' ? parseInt(c.month) : c.month
        return cy === yr && cm === i + 1
      })
      return {
        name,
        revenue: mc.reduce((s, c) => s + Number(c.revenue_amount || 0), 0),
        paid: mc.filter(c => c.status === 'PAID').reduce((s, c) => s + Number(c.revenue_amount || 0), 0),
        pending: mc.filter(c => c.status === 'PENDING').reduce((s, c) => s + Number(c.revenue_amount || 0), 0),
        count: mc.length,
      }
    })

    // Revenue by quarter
    const revenueByQuarter = ['Q1','Q2','Q3','Q4'].map((q, qi) => {
      const months = [qi*3+1, qi*3+2, qi*3+3]
      const mc = commissions.filter(c => {
        const cy = typeof c.year === 'string' ? parseInt(c.year) : c.year
        const cm = typeof c.month === 'string' ? parseInt(c.month) : c.month
        return cy === yr && months.includes(cm)
      })
      return { name: q, revenue: mc.reduce((s, c) => s + Number(c.revenue_amount || 0), 0) }
    })

    // Revenue by year (all time)
    const years = [...new Set(commissions.map(c => typeof c.year === 'string' ? parseInt(c.year) : c.year))].sort()
    const revenueByYear = years.map(y => ({
      name: y.toString(),
      revenue: commissions.filter(c => (typeof c.year === 'string' ? parseInt(c.year) : c.year) === y)
        .reduce((s, c) => s + Number(c.revenue_amount || 0), 0)
    }))

    // Revenue by deal type
    const dealTypes = {}
    commissions.forEach(c => {
      const cy = typeof c.year === 'string' ? parseInt(c.year) : c.year
      if (cy === yr) dealTypes[c.deal_type] = (dealTypes[c.deal_type] || 0) + Number(c.revenue_amount || 0)
    })
    const revenueByDealType = Object.entries(dealTypes).map(([name, value]) => ({ name, value }))

    // Revenue by broker
    const brokerRev = {}
    commissions.forEach(c => {
      const cy = typeof c.year === 'string' ? parseInt(c.year) : c.year
      if (cy === yr && c.broker_id) brokerRev[c.broker_id] = (brokerRev[c.broker_id] || 0) + Number(c.revenue_amount || 0)
    })
    const revenueByBroker = Object.entries(brokerRev)
      .sort(([,a],[,b]) => b - a).slice(0, 6)
      .map(([id, revenue]) => ({ name: brokers.find(b => b.id === id)?.name || 'Unknown', revenue }))

    // Affiliates by status
    const affByStatus = {}
    affiliates.forEach(a => { affByStatus[a.status] = (affByStatus[a.status] || 0) + 1 })
    const affiliatesByStatus = Object.entries(affByStatus).map(([name, value]) => ({ name, value }))

    // New affiliates by month for selected year
    const newAffByMonth = MONTHS.map((name, i) => ({
      name,
      count: affiliates.filter(a => {
        if (!a.created_at) return false
        const d = new Date(a.created_at)
        return d.getFullYear() === yr && d.getMonth() === i
      }).length
    }))

    // Appointments by month
    const apptByMonth = MONTHS.map((name, i) => ({
      name,
      total: appointments.filter(a => {
        const d = new Date(a.scheduled_at)
        return d.getFullYear() === yr && d.getMonth() === i
      }).length,
      completed: appointments.filter(a => {
        const d = new Date(a.scheduled_at)
        return d.getFullYear() === yr && d.getMonth() === i && a.status === 'COMPLETED'
      }).length,
    }))

    // Top affiliates by revenue (all time)
    const affRev = {}
    commissions.forEach(c => { affRev[c.affiliate_id] = (affRev[c.affiliate_id] || 0) + Number(c.revenue_amount || 0) })
    const topAffiliates = Object.entries(affRev)
      .sort(([,a],[,b]) => b - a).slice(0, 8)
      .map(([id, revenue]) => ({ name: affiliates.find(a => a.id === id)?.name || 'Unknown', revenue }))

    const totalRevYear = commissions.filter(c => (typeof c.year === 'string' ? parseInt(c.year) : c.year) === yr)
      .reduce((s, c) => s + Number(c.revenue_amount || 0), 0)
    const totalRevAllTime = commissions.reduce((s, c) => s + Number(c.revenue_amount || 0), 0)
    const avgMonthlyRev = revenueByMonth.filter(m => m.revenue > 0).length > 0
      ? totalRevYear / revenueByMonth.filter(m => m.revenue > 0).length : 0

    setData({
      revenueByMonth, revenueByQuarter, revenueByYear, revenueByDealType,
      revenueByBroker, affiliatesByStatus, newAffByMonth, apptByMonth, topAffiliates,
      totalRevYear, totalRevAllTime, avgMonthlyRev,
      totalAff: affiliates.length, activeAff: affiliates.filter(a => a.status === 'ACTIVE').length,
    })
    setLoading(false)
  }

  const fmt = (n) => `$${Number(n||0).toLocaleString('en-US', { maximumFractionDigits: 0 })}`
  const ChartCard = ({ title, children, span = 1 }) => (
    <Card className={span === 2 ? 'lg:col-span-2' : ''}>
      <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">{title}</CardTitle></CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
  const tooltipStyle = {
    contentStyle: { backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' },
  }

  if (loading) return <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">{[...Array(6)].map((_,i) => <Skeleton key={i} className="h-64 rounded-xl" />)}</div>

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-outfit font-bold">Analytics</h1>
          <p className="text-sm text-muted-foreground">Revenue, performance & business insights</p>
        </div>
        <Select value={yearFilter} onValueChange={setYearFilter}>
          <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
          <SelectContent>{[2023,2024,2025,2026].map(y => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: `${yearFilter} Revenue`, value: fmt(data.totalRevYear), sub: `${fmt(data.avgMonthlyRev)}/mo avg` },
          { label: 'All-Time Revenue', value: fmt(data.totalRevAllTime), sub: 'Total since inception' },
          { label: 'Total Affiliates', value: data.totalAff, sub: `${data.activeAff} active` },
          { label: 'Avg Monthly', value: fmt(data.avgMonthlyRev), sub: `in ${yearFilter}` },
        ].map(k => (
          <Card key={k.label}>
            <CardContent className="pt-4 pb-3">
              <p className="text-2xl font-outfit font-bold">{k.value}</p>
              <p className="text-xs font-medium mt-0.5">{k.label}</p>
              <p className="text-xs text-muted-foreground">{k.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Revenue by Month */}
        <ChartCard title={`Monthly Revenue — ${yearFilter}`} span={2}>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.revenueByMonth} margin={{ top:4, right:8, left:0, bottom:0 }}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fill:'hsl(var(--muted-foreground))', fontSize:11 }} />
                <YAxis tick={{ fill:'hsl(var(--muted-foreground))', fontSize:11 }} tickFormatter={v=>`$${v>=1000?(v/1000).toFixed(0)+'k':v}`} />
                <Tooltip {...tooltipStyle} formatter={v => [fmt(v), '']} />
                <Area type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" fill="url(#revGrad)" strokeWidth={2} name="Total" />
                <Area type="monotone" dataKey="paid" stroke="#10B981" fill="none" strokeWidth={1.5} strokeDasharray="4 2" name="Paid" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        {/* Revenue by Quarter */}
        <ChartCard title={`Quarterly Revenue — ${yearFilter}`}>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.revenueByQuarter} margin={{ top:4, right:8, left:0, bottom:0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fill:'hsl(var(--muted-foreground))', fontSize:12 }} />
                <YAxis tick={{ fill:'hsl(var(--muted-foreground))', fontSize:11 }} tickFormatter={v=>`$${v>=1000?(v/1000).toFixed(0)+'k':v}`} />
                <Tooltip {...tooltipStyle} formatter={v => [fmt(v), 'Revenue']} />
                <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[6,6,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        {/* Revenue by Deal Type (Pie) */}
        <ChartCard title={`Revenue Mix by Deal Type — ${yearFilter}`}>
          <div className="h-52 flex items-center">
            {data.revenueByDealType.length === 0 ? (
              <p className="text-sm text-muted-foreground mx-auto">No data for {yearFilter}</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={data.revenueByDealType} cx="50%" cy="50%" outerRadius={80} dataKey="value" nameKey="name" label={({name,percent})=>`${name} ${(percent*100).toFixed(0)}%`} labelLine={false}>
                    {data.revenueByDealType.map((_,i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip {...tooltipStyle} formatter={v => [fmt(v), 'Revenue']} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </ChartCard>

        {/* Revenue by Year */}
        <ChartCard title="Year-over-Year Revenue">
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.revenueByYear} margin={{ top:4, right:8, left:0, bottom:0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fill:'hsl(var(--muted-foreground))', fontSize:12 }} />
                <YAxis tick={{ fill:'hsl(var(--muted-foreground))', fontSize:11 }} tickFormatter={v=>`$${v>=1000?(v/1000).toFixed(0)+'k':v}`} />
                <Tooltip {...tooltipStyle} formatter={v => [fmt(v), 'Revenue']} />
                <Bar dataKey="revenue" fill="#8B5CF6" radius={[6,6,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        {/* Revenue by Broker */}
        <ChartCard title={`Revenue by Broker — ${yearFilter}`}>
          <div className="h-52">
            {data.revenueByBroker.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">No broker revenue data for {yearFilter}</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.revenueByBroker} layout="vertical" margin={{ top:4, right:16, left:4, bottom:0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" tick={{ fill:'hsl(var(--muted-foreground))', fontSize:10 }} tickFormatter={v=>`$${v>=1000?(v/1000).toFixed(0)+'k':v}`} />
                  <YAxis type="category" dataKey="name" tick={{ fill:'hsl(var(--muted-foreground))', fontSize:10 }} width={80} />
                  <Tooltip {...tooltipStyle} formatter={v => [fmt(v), 'Revenue']} />
                  <Bar dataKey="revenue" fill="#10B981" radius={[0,6,6,0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </ChartCard>

        {/* Top Affiliates Bar */}
        <ChartCard title="Top Affiliates — All Time Revenue" span={2}>
          <div className="h-52">
            {data.topAffiliates.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">No revenue data yet</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.topAffiliates} margin={{ top:4, right:8, left:0, bottom:30 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fill:'hsl(var(--muted-foreground))', fontSize:10 }} angle={-20} textAnchor="end" />
                  <YAxis tick={{ fill:'hsl(var(--muted-foreground))', fontSize:11 }} tickFormatter={v=>`$${v>=1000?(v/1000).toFixed(0)+'k':v}`} />
                  <Tooltip {...tooltipStyle} formatter={v => [fmt(v), 'Revenue']} />
                  <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </ChartCard>

        {/* Affiliates by Status Pie */}
        <ChartCard title="Affiliates by Status">
          <div className="h-52 flex items-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data.affiliatesByStatus} cx="50%" cy="50%" outerRadius={75} dataKey="value" nameKey="name" label={({name,value})=>`${name}: ${value}`} labelLine={false}>
                  {data.affiliatesByStatus.map((_,i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip {...tooltipStyle} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        {/* Appointments by Month */}
        <ChartCard title={`Appointments by Month — ${yearFilter}`}>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.apptByMonth} margin={{ top:4, right:8, left:0, bottom:0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fill:'hsl(var(--muted-foreground))', fontSize:11 }} />
                <YAxis tick={{ fill:'hsl(var(--muted-foreground))', fontSize:11 }} allowDecimals={false} />
                <Tooltip {...tooltipStyle} />
                <Bar dataKey="total" fill="#F59E0B" radius={[4,4,0,0]} name="Total" />
                <Bar dataKey="completed" fill="#10B981" radius={[4,4,0,0]} name="Completed" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

      </div>
    </div>
  )
}
