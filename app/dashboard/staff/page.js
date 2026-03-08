'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Search, UserCog, Download, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

export default function StaffPage() {
  const [staff, setStaff] = useState([])
  const [affiliateCounts, setAffiliateCounts] = useState({})
  const [revenueTotals, setRevenueTotals] = useState({})
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    const load = async () => {
      setLoading(true)
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
      setLoading(false)
    }
    load()
  }, [])

  const filtered = staff.filter(s => {
    const fullName = `${s.first_name} ${s.last_name}`.toLowerCase()
    if (search && !fullName.includes(search.toLowerCase())) return false
    if (roleFilter !== 'all' && s.role !== roleFilter) return false
    if (statusFilter === 'active' && !s.is_active) return false
    if (statusFilter === 'inactive' && s.is_active) return false
    return true
  })

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

  const exportCSV = () => {
    const headers = ['Name', 'Role', 'Status', 'Affiliates', 'Revenue', 'Start Date']
    const rows = filtered.map(s => [
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

  if (loading) return <div className="space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-12 rounded-lg" />)}</div>

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-outfit font-bold">Staff Management</h1>
          <p className="text-sm text-muted-foreground">{staff.length} staff members &bull; {filtered.length} shown</p>
        </div>
        <Button variant="outline" size="sm" onClick={exportCSV}>
          <Download className="w-4 h-4 mr-1" /> Export CSV
        </Button>
      </div>

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
                  className={`px-3 py-2 text-sm font-medium transition-colors ${
                    roleFilter === r ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
                  }`}>{r === 'all' ? 'All Roles' : r}</button>
              ))}
            </div>
            <div className="flex border rounded-lg overflow-hidden">
              {[['all','All'],['active','Active'],['inactive','Inactive']].map(([v,l]) => (
                <button key={v} onClick={() => setStatusFilter(v)}
                  className={`px-3 py-2 text-sm font-medium transition-colors ${
                    statusFilter === v ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
                  }`}>{l}</button>
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
                {filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                    <UserCog className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    No staff members found.
                  </TableCell></TableRow>
                ) : filtered.map(s => (
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
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-500 hover:text-red-600 hover:bg-red-50"
                        onClick={() => setDeleteTarget(s)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null) }}>
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
