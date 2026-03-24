'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Users, Clock, TrendingUp, Building2 } from 'lucide-react'
import Link from 'next/link'
import { useUserRole } from '@/lib/hooks/useUserRole'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from 'recharts'

const STATUS_COLORS = {
  ACTIVE: 'bg-green-50 text-green-700 border-green-200',
  ONBOARDING: 'bg-blue-50 text-blue-700 border-blue-200',
  LEAD: 'bg-purple-50 text-purple-700 border-purple-200',
  INACTIVE: 'bg-red-50 text-red-700 border-red-200',
}

// Pastel colours matching the screenshot
const PASTEL_COLORS = ['#93c5fd','#f9a8d4','#86efac','#fde68a','#c4b5fd','#fdba74','#67e8f9','#a7f3d0']

export default function AffiliateDashboardPage() {
  const [loading, setLoading] = useState(true)
  const [affiliates, setAffiliates] = useState([])
  const [brokers, setBrokers] = useState([])
  const { userId, role } = useUserRole()
  const isAdmin = role === 'ADMIN'
  const supabase = createClient()

  useEffect(() => {
    if (!userId || !role) return
    load()
  }, [userId, role])

  const load = async () => {
    setLoading(true)
    try {
      let affQuery = supabase
        .from('affiliates')
        .select('id, name, email, phone, status, deal_type, created_at, manager_id, affiliate_brokers(broker_id, broker:brokers(name))')
      if (!isAdmin) affQuery = affQuery.eq('manager_id', userId)

      const [affRes, brkRes] = await Promise.all([
        affQuery,
        supabase.from('brokers').select('id, name'),
      ])
      setAffiliates(affRes.data || [])
      setBrokers(brkRes.data || [])
    } catch (err) {
      console.error('Affiliate dashboard load error:', err)
    } finally {
      setLoading(false)
    }
  }

  // Derived stats
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const monthName = now.toLocaleString('en', { month: 'long' })

  const activeAffiliates = affiliates.filter(a => a.status === 'ACTIVE')
  const onboardingAffiliates = affiliates.filter(a => a.status === 'ONBOARDING')
  const newThisMonth = affiliates.filter(a => a.created_at && new Date(a.created_at) >= startOfMonth)
  // Active brokers = distinct brokers that have at least 1 active affiliate
  const activeBrokerIds = new Set(activeAffiliates.flatMap(a => (a.affiliate_brokers || []).map(ab => ab.broker_id)).filter(Boolean))
  const activeBrokerCount = activeBrokerIds.size

  // Top 5 latest affiliates
  const top5Latest = [...affiliates]
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 5)

  // Affiliates per broker chart data
  const perBroker = {}
  affiliates.forEach(a => {
    const abs = a.affiliate_brokers || []
    if (abs.length === 0) { perBroker['No Broker'] = (perBroker['No Broker'] || 0) + 1; return }
    abs.forEach(ab => {
      const name = ab.broker?.name || 'Unknown'
      perBroker[name] = (perBroker[name] || 0) + 1
    })
  })
  const chartData = Object.entries(perBroker).map(([name, count]) => ({ name, count }))

  const statCards = [
    {
      label: 'Total Active Affiliates',
      value: activeAffiliates.length,
      sub: 'All active affiliates',
      icon: Users,
      iconColor: 'text-blue-500',
      bg: 'bg-blue-50',
    },
    {
      label: 'Onboarding',
      value: onboardingAffiliates.length,
      sub: 'Last 30 days',
      icon: Clock,
      iconColor: 'text-purple-500',
      bg: 'bg-purple-50',
    },
    {
      label: 'New Affiliates This Month',
      value: newThisMonth.length,
      sub: monthName,
      icon: TrendingUp,
      iconColor: 'text-green-500',
      bg: 'bg-green-50',
    },
    {
      label: 'Active Brokers',
      value: activeBrokerCount,
      sub: 'With affiliates',
      icon: Building2,
      iconColor: 'text-amber-500',
      bg: 'bg-amber-50',
    },
  ]

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-outfit font-bold">Affiliate Dashboard</h1>
        <p className="text-sm text-muted-foreground">Overview of affiliate/IB activity and performance</p>
      </div>

      {/* 4 Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card, i) => (
          <Card key={i} className="hover:shadow-md transition-shadow">
            <CardContent className="pt-4 pb-4 px-4">
              <div className={`w-8 h-8 rounded-lg ${card.bg} flex items-center justify-center mb-3`}>
                <card.icon className={`w-4 h-4 ${card.iconColor}`} />
              </div>
              <p className="text-2xl font-outfit font-bold">{card.value}</p>
              <p className="text-xs font-medium text-foreground mt-0.5">{card.label}</p>
              <p className="text-xs text-muted-foreground">{card.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Affiliates in Onboarding Stage */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Affiliates in Onboarding Stage</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {onboardingAffiliates.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No affiliates currently in onboarding.</p>
          ) : (
            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead className="text-blue-600 font-medium">Name</TableHead>
                    <TableHead className="text-blue-600 font-medium">Email</TableHead>
                    <TableHead className="text-blue-600 font-medium">Broker</TableHead>
                    <TableHead className="text-blue-600 font-medium">Deal Type</TableHead>
                    <TableHead className="text-blue-600 font-medium">Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {onboardingAffiliates.map(a => (
                    <TableRow key={a.id} className="hover:bg-muted/20">
                      <TableCell>
                        <Link href={`/dashboard/affiliates/${a.id}`} className="font-medium hover:text-primary hover:underline">
                          {a.name}
                        </Link>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{a.email}</TableCell>
                      <TableCell className="text-sm">{(a.affiliate_brokers||[]).map(ab=>ab.broker?.name).filter(Boolean).join(', ') || '—'}</TableCell>
                      <TableCell>
                        {a.deal_type ? (
                          <Badge variant="outline" className="text-xs font-medium">{a.deal_type}</Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(a.created_at).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Top 5 Latest Affiliates */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Top 5 Latest Affiliates by Date Created</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {top5Latest.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No affiliates yet.</p>
          ) : (
            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead className="text-blue-600 font-medium">Name</TableHead>
                    <TableHead className="text-blue-600 font-medium">Email</TableHead>
                    <TableHead className="text-blue-600 font-medium">Phone</TableHead>
                    <TableHead className="text-blue-600 font-medium">Broker</TableHead>
                    <TableHead className="text-blue-600 font-medium">Status</TableHead>
                    <TableHead className="text-blue-600 font-medium">Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {top5Latest.map(a => (
                    <TableRow key={a.id} className="hover:bg-muted/20">
                      <TableCell>
                        <Link href={`/dashboard/affiliates/${a.id}`} className="font-medium hover:text-primary hover:underline">
                          {a.name}
                        </Link>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{a.email}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{a.phone || '—'}</TableCell>
                      <TableCell className="text-sm">{(a.affiliate_brokers||[]).map(ab=>ab.broker?.name).filter(Boolean).join(', ') || '—'}</TableCell>
                      <TableCell>
                        <Badge className={`text-xs ${STATUS_COLORS[a.status] || ''}`}>{a.status}</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(a.created_at).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Number of Affiliates per Broker */}
      {chartData.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Number of Affiliates per Broker</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis
                    dataKey="name"
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                    formatter={(val) => [val, 'Affiliates']}
                  />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]} name="Affiliates">
                    {chartData.map((_, i) => (
                      <Cell key={i} fill={PASTEL_COLORS[i % PASTEL_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
