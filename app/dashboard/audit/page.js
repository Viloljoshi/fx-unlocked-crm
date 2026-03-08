'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ScrollText } from 'lucide-react'

export default function AuditPage() {
  const [logs, setLogs] = useState([])
  const [profiles, setProfiles] = useState({})
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      const [logsRes, profsRes] = await Promise.all([
        supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(100),
        supabase.from('profiles').select('id, first_name, last_name'),
      ])
      setLogs(logsRes.data || [])
      const map = {}
      ;(profsRes.data || []).forEach(p => { map[p.id] = `${p.first_name} ${p.last_name}`.trim() })
      setProfiles(map)
      setLoading(false)
    }
    load()
  }, [])

  const ACTION_COLORS = { CREATE: 'bg-green-50 text-green-700 border-green-200', UPDATE: 'bg-blue-50 text-blue-700 border-blue-200', DELETE: 'bg-red-50 text-red-700 border-red-200' }

  if (loading) return <div className="space-y-4">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-14 rounded-lg" />)}</div>

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-outfit font-bold">Audit Log</h1>
        <p className="text-sm text-muted-foreground">System activity history</p>
      </div>
      <Card className="glass-card">
        <CardContent className="pt-4">
          {logs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <ScrollText className="w-10 h-10 mx-auto mb-3 opacity-50" />
              <p>No audit logs yet.</p>
            </div>
          ) : (
            <div className="rounded-lg border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-secondary/50">
                    <TableHead>User</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Entity</TableHead>
                    <TableHead>Changes</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map(l => (
                    <TableRow key={l.id}>
                      <TableCell className="font-medium">{profiles[l.user_id] || 'System'}</TableCell>
                      <TableCell><Badge className={ACTION_COLORS[l.action] || ''}>{l.action}</Badge></TableCell>
                      <TableCell><Badge variant="outline">{l.entity_type}</Badge></TableCell>
                      <TableCell className="max-w-xs truncate text-xs text-muted-foreground">{l.changes ? JSON.stringify(l.changes).substring(0, 60) : '-'}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{new Date(l.created_at).toLocaleString()}</TableCell>
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
