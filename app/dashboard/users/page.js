'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { toast } from 'sonner'
import { UserPlus, Users, Mail, Trash2, KeyRound, ShieldAlert, Pencil } from 'lucide-react'
import { useUserRole } from '@/lib/hooks/useUserRole'

const CURRENCIES = ['USD', 'GBP', 'EUR', 'AUD', 'CAD', 'NZD']

export default function UsersPage() {
  const { role, userId: currentUserId, loading: roleLoading } = useUserRole()
  const isAdmin = role === 'ADMIN'
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('STAFF')
  const [inviteFirstName, setInviteFirstName] = useState('')
  const [inviteLastName, setInviteLastName] = useState('')
  const [inviting, setInviting] = useState(false)
  const [inviteSent, setInviteSent] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)
  // Edit user state
  const [editTarget, setEditTarget] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [editSaving, setEditSaving] = useState(false)
  const supabase = createClient()

  useEffect(() => { load() }, [])

  const load = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/users')
      if (res.ok) {
        const data = await res.json()
        setUsers(data.users || [])
      } else {
        const { data } = await supabase.from('profiles').select('*').order('created_at', { ascending: false })
        setUsers(data || [])
      }
    } catch {
      const { data } = await supabase.from('profiles').select('*').order('created_at', { ascending: false })
      setUsers(data || [])
    }
    setLoading(false)
  }

  const inviteUser = async () => {
    if (!inviteEmail) { toast.error('Email is required'); return }
    setInviting(true)
    try {
      const res = await fetch('/api/users/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: inviteEmail,
          role: inviteRole,
          firstName: inviteFirstName,
          lastName: inviteLastName,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Invite failed')
      setInviteSent(true)
      toast.success(data.message || `Invitation sent to ${inviteEmail}`)
      load()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setInviting(false)
    }
  }

  const resetInviteForm = () => {
    setInviteOpen(false)
    setInviteEmail('')
    setInviteFirstName('')
    setInviteLastName('')
    setInviteRole('STAFF')
    setInviteSent(false)
  }

  const openEdit = (u) => {
    setEditTarget(u)
    setEditForm({
      first_name: u.first_name || '',
      last_name: u.last_name || '',
      role: u.role || 'STAFF',
      is_active: u.is_active !== false,
      start_date: u.start_date || '',
      salary: u.salary != null ? String(u.salary) : '',
      salary_currency: u.salary_currency || 'USD',
    })
  }

  const handleEditSave = async () => {
    if (!editTarget) return
    // Security: prevent removing own ADMIN role
    if (editTarget.id === currentUserId && editForm.role !== 'ADMIN') {
      toast.error("You can't downgrade your own Admin role")
      return
    }
    // Security: prevent deactivating own account
    if (editTarget.id === currentUserId && !editForm.is_active) {
      toast.error("You can't deactivate your own account")
      return
    }
    // Validate salary
    if (editForm.salary !== '' && (isNaN(parseFloat(editForm.salary)) || parseFloat(editForm.salary) < 0)) {
      toast.error('Salary must be a positive number')
      return
    }
    setEditSaving(true)
    const payload = {
      first_name: editForm.first_name.trim() || null,
      last_name: editForm.last_name.trim() || null,
      role: editForm.role,
      is_active: editForm.is_active,
      start_date: editForm.start_date || null,
      salary: editForm.salary !== '' ? parseFloat(editForm.salary) : null,
      salary_currency: editForm.salary_currency || 'USD',
    }
    const { error } = await supabase.from('profiles').update(payload).eq('id', editTarget.id)
    if (error) { toast.error(error.message); setEditSaving(false); return }
    toast.success('User updated')
    setEditTarget(null)
    setEditSaving(false)
    load()
  }

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
      toast.success(`${getDisplayName(deleteTarget)} removed`)
      setUsers(prev => prev.filter(u => u.id !== deleteTarget.id))
    } catch (err) {
      toast.error(err.message)
    } finally {
      setDeleting(false)
      setDeleteTarget(null)
    }
  }

  const sendPasswordReset = async (email) => {
    if (!email) { toast.error('No email address for this user'); return }
    try {
      await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      toast.success(`Password reset email sent to ${email}`)
    } catch {
      toast.error('Failed to send reset email')
    }
  }

  const getDisplayName = (u) => {
    if (!u) return ''
    const name = `${u.first_name || ''} ${u.last_name || ''}`.trim()
    return name || '(Name not set)'
  }

  const formatSalary = (u) => {
    if (u.salary == null || u.salary === '') return '-'
    const symbol = { USD: '$', GBP: '£', EUR: '€', AUD: 'A$', CAD: 'C$', NZD: 'NZ$' }[u.salary_currency] || ''
    return `${symbol}${Number(u.salary).toLocaleString()}`
  }

  if (roleLoading || loading) return <div className="space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-14 rounded-lg" />)}</div>

  if (!isAdmin) return (
    <div className="flex flex-col items-center justify-center py-24 text-center space-y-3">
      <ShieldAlert className="w-12 h-12 text-muted-foreground opacity-40" />
      <p className="text-lg font-semibold">Access Restricted</p>
      <p className="text-sm text-muted-foreground">Only Admins can manage Users.</p>
    </div>
  )

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-outfit font-bold">User Management</h1>
          <p className="text-sm text-muted-foreground">{users.length} users</p>
        </div>
        <Button onClick={() => setInviteOpen(true)}>
          <UserPlus className="w-4 h-4 mr-2" /> Create User
        </Button>
      </div>

      <Card>
        <CardContent className="pt-4">
          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Salary</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                    <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    No users yet. Invite someone to get started.
                  </TableCell></TableRow>
                ) : users.map(u => (
                  <TableRow key={u.id} className="hover:bg-muted/30">
                    <TableCell>
                      <p className={`font-medium text-sm ${!u.first_name && !u.last_name ? 'text-muted-foreground italic' : ''}`}>
                        {getDisplayName(u)}
                        {u.id === currentUserId && <span className="ml-1.5 text-xs text-muted-foreground">(you)</span>}
                      </p>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      <div className="flex items-center gap-1">
                        <Mail className="w-3 h-3" />
                        {u.email || <span className="italic">Not available</span>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">{u.role || 'STAFF'}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={u.is_active !== false
                        ? 'bg-green-50 text-green-700 border-green-200'
                        : 'bg-red-50 text-red-700 border-red-200'
                      }>{u.is_active !== false ? 'Active' : 'Inactive'}</Badge>
                    </TableCell>
                    <TableCell className="text-sm font-medium">{formatSalary(u)}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {u.created_at ? new Date(u.created_at).toLocaleDateString() : '-'}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-primary hover:bg-primary/10"
                          title="Edit user"
                          onClick={() => openEdit(u)}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-primary hover:bg-primary/10"
                          title="Send password reset email"
                          onClick={() => sendPasswordReset(u.email)}>
                          <KeyRound className="w-3.5 h-3.5" />
                        </Button>
                        {u.id !== currentUserId && (
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-500 hover:text-red-600 hover:bg-red-50"
                            title="Delete user"
                            onClick={() => setDeleteTarget(u)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Edit User Dialog */}
      <Dialog open={!!editTarget} onOpenChange={(o) => { if (!o) setEditTarget(null) }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="w-4 h-4" /> Edit User — {getDisplayName(editTarget)}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>First Name</Label>
                <Input value={editForm.first_name || ''} onChange={e => setEditForm(f => ({...f, first_name: e.target.value}))} placeholder="First name" />
              </div>
              <div className="space-y-1.5">
                <Label>Last Name</Label>
                <Input value={editForm.last_name || ''} onChange={e => setEditForm(f => ({...f, last_name: e.target.value}))} placeholder="Last name" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input value={editTarget?.email || ''} disabled className="opacity-60 cursor-not-allowed" />
              <p className="text-xs text-muted-foreground">Email cannot be changed here. Use password reset to update credentials.</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Role</Label>
                <Select
                  value={editForm.role || 'STAFF'}
                  onValueChange={v => setEditForm(f => ({...f, role: v}))}
                  disabled={editTarget?.id === currentUserId}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ADMIN">Admin</SelectItem>
                    <SelectItem value="STAFF">Staff</SelectItem>
                    <SelectItem value="VIEWER">Viewer</SelectItem>
                  </SelectContent>
                </Select>
                {editTarget?.id === currentUserId && (
                  <p className="text-xs text-muted-foreground">You cannot change your own role.</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select
                  value={editForm.is_active ? 'active' : 'inactive'}
                  onValueChange={v => setEditForm(f => ({...f, is_active: v === 'active'}))}
                  disabled={editTarget?.id === currentUserId}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
                {editTarget?.id === currentUserId && (
                  <p className="text-xs text-muted-foreground">You cannot deactivate your own account.</p>
                )}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Start Date</Label>
              <Input type="date" value={editForm.start_date || ''} onChange={e => setEditForm(f => ({...f, start_date: e.target.value}))} />
            </div>
            {/* Salary — ADMIN only (page is already ADMIN-restricted) */}
            <div className="space-y-1.5">
              <Label>Salary</Label>
              <div className="flex gap-2">
                <Select value={editForm.salary_currency || 'USD'} onValueChange={v => setEditForm(f => ({...f, salary_currency: v}))}>
                  <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                  <SelectContent>{CURRENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
                <Input
                  type="number"
                  min="0"
                  value={editForm.salary || ''}
                  onChange={e => setEditForm(f => ({...f, salary: e.target.value}))}
                  placeholder="Annual salary"
                  className="flex-1"
                />
              </div>
              <p className="text-xs text-muted-foreground">Salary is only visible to Admins.</p>
            </div>
            <div className="flex gap-2 justify-end pt-1">
              <Button variant="outline" onClick={() => setEditTarget(null)}>Cancel</Button>
              <Button onClick={handleEditSave} disabled={editSaving}>
                {editSaving ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete &ldquo;{getDisplayName(deleteTarget)}&rdquo;?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove their account and login access. Their affiliates will be unassigned.
              <br /><strong className="text-destructive">This cannot be undone.</strong>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={deleteUser} disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting ? 'Deleting...' : 'Delete User'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Create User Modal */}
      <Dialog open={inviteOpen} onOpenChange={(open) => { if (!open) resetInviteForm(); else setInviteOpen(true) }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><UserPlus className="w-4 h-4" /> Create New User</DialogTitle>
          </DialogHeader>

          {inviteSent ? (
            <div className="text-center py-6 space-y-3">
              <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                <Mail className="w-7 h-7 text-green-600" />
              </div>
              <h3 className="font-semibold text-lg">User Created!</h3>
              <p className="text-sm text-muted-foreground">
                A branded invite email was sent to <strong>{inviteEmail}</strong>.<br />
                They&apos;ll receive a secure link to set their own password and access their account.
              </p>
              <div className="flex gap-2 justify-center pt-2">
                <Button variant="outline" onClick={resetInviteForm}>Close</Button>
                <Button onClick={() => { setInviteSent(false); setInviteEmail(''); setInviteFirstName(''); setInviteLastName('') }}>
                  Create Another
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4 pt-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>First Name</Label>
                  <Input value={inviteFirstName} onChange={e => setInviteFirstName(e.target.value)} placeholder="John" />
                </div>
                <div className="space-y-1.5">
                  <Label>Last Name</Label>
                  <Input value={inviteLastName} onChange={e => setInviteLastName(e.target.value)} placeholder="Doe" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Email Address <span className="text-destructive">*</span></Label>
                <Input value={inviteEmail} onChange={e => setInviteEmail(e.target.value)}
                  placeholder="user@company.com" type="email" />
              </div>
              <div className="space-y-1.5">
                <Label>Role</Label>
                <Select value={inviteRole} onValueChange={setInviteRole}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ADMIN">Admin</SelectItem>
                    <SelectItem value="STAFF">Staff</SelectItem>
                    <SelectItem value="VIEWER">Viewer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="bg-muted/50 rounded-lg p-3 text-xs text-muted-foreground">
                <strong>How it works:</strong> A branded invite email is sent to the user with a secure one-time link. They click it, set their own password, and get instant access. You never handle their password.
              </div>
              <div className="flex gap-2 justify-end pt-1">
                <Button variant="outline" onClick={resetInviteForm}>Cancel</Button>
                <Button onClick={inviteUser} disabled={inviting}>
                  <UserPlus className="w-4 h-4 mr-2" />
                  {inviting ? 'Creating...' : 'Create User'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
