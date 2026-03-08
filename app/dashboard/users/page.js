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
import { UserPlus, Users, Mail, Trash2, KeyRound, Eye, EyeOff, ShieldAlert } from 'lucide-react'
import { useUserRole } from '@/lib/hooks/useUserRole'

export default function UsersPage() {
  const { role, loading: roleLoading } = useUserRole()
  const isAdmin = role === 'ADMIN'
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('STAFF')
  const [inviteFirstName, setInviteFirstName] = useState('')
  const [inviteLastName, setInviteLastName] = useState('')
  const [invitePassword, setInvitePassword] = useState('')
  const [showInvitePassword, setShowInvitePassword] = useState(false)
  const [inviting, setInviting] = useState(false)
  const [inviteSent, setInviteSent] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const supabase = createClient()

  useEffect(() => { load() }, [])

  const load = async () => {
    setLoading(true)
    try {
      // Use API route to get users with emails (merged from auth.users)
      const res = await fetch('/api/users')
      if (res.ok) {
        const data = await res.json()
        setUsers(data.users || [])
      } else {
        // Fallback: load profiles only
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
          password: invitePassword,
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
    setInvitePassword('')
    setShowInvitePassword(false)
    setInviteSent(false)
  }

  const toggleRole = async (userId, newRole) => {
    const { error } = await supabase.from('profiles').update({ role: newRole }).eq('id', userId)
    if (error) { toast.error(error.message); return }
    toast.success('Role updated')
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u))
  }

  const toggleActive = async (userId, isActive) => {
    const { error } = await supabase.from('profiles').update({ is_active: !isActive }).eq('id', userId)
    if (error) { toast.error(error.message); return }
    toast.success(isActive ? 'User deactivated' : 'User activated')
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, is_active: !isActive } : u))
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
      const supabaseClient = createClient()
      const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      })
      if (error) throw error
      toast.success(`Password reset email sent to ${email}`)
    } catch (err) {
      toast.error(err.message || 'Failed to send reset email')
    }
  }

  const getDisplayName = (u) => {
    if (!u) return ''
    const name = `${u.first_name || ''} ${u.last_name || ''}`.trim()
    return name || '(Name not set)'
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
                  <TableHead>Joined</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                    <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    No users yet. Invite someone to get started.
                  </TableCell></TableRow>
                ) : users.map(u => (
                  <TableRow key={u.id} className="hover:bg-muted/30">
                    <TableCell>
                      <div>
                        <p className={`font-medium text-sm ${
                          !u.first_name && !u.last_name ? 'text-muted-foreground italic' : ''
                        }`}>{getDisplayName(u)}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      <div className="flex items-center gap-1">
                        <Mail className="w-3 h-3" />
                        {u.email || <span className="italic">Not available</span>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Select value={u.role || 'STAFF'} onValueChange={v => toggleRole(u.id, v)}>
                        <SelectTrigger className="w-28 h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ADMIN">ADMIN</SelectItem>
                          <SelectItem value="STAFF">STAFF</SelectItem>
                          <SelectItem value="VIEWER">VIEWER</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Badge className={u.is_active !== false
                        ? 'bg-green-50 text-green-700 border-green-200'
                        : 'bg-red-50 text-red-700 border-red-200'
                      }>{u.is_active !== false ? 'Active' : 'Inactive'}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {u.created_at ? new Date(u.created_at).toLocaleDateString() : '-'}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="sm" className="h-7 text-xs"
                          onClick={() => toggleActive(u.id, u.is_active !== false)}>
                          {u.is_active !== false ? 'Deactivate' : 'Activate'}
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-primary hover:bg-primary/10"
                          title="Send password reset email"
                          onClick={() => sendPasswordReset(u.email)}>
                          <KeyRound className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-500 hover:text-red-600 hover:bg-red-50"
                          title="Delete user"
                          onClick={() => setDeleteTarget(u)}>
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

      {/* Invite User Modal */}
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
                An invite email was sent to <strong>{inviteEmail}</strong>.<br />
                They can log in now with the password you set, or use the link in the invite email.
              </p>
              <div className="flex gap-2 justify-center pt-2">
                <Button variant="outline" onClick={resetInviteForm}>Close</Button>
                <Button onClick={() => { setInviteSent(false); setInviteEmail(''); setInviteFirstName(''); setInviteLastName(''); setInvitePassword('') }}>
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
                <Label>Initial Password <span className="text-destructive">*</span></Label>
                <div className="relative">
                  <Input
                    type={showInvitePassword ? 'text' : 'password'}
                    value={invitePassword}
                    onChange={e => setInvitePassword(e.target.value)}
                    placeholder="Min. 6 characters"
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowInvitePassword(!showInvitePassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showInvitePassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
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
                <strong>How it works:</strong> The user is created immediately with the password you set — they can log in right away. An invite email is also sent so they can reset their password anytime.
              </div>
              <div className="flex gap-2 justify-end pt-1">
                <Button variant="outline" onClick={resetInviteForm}>Cancel</Button>
                <Button onClick={inviteUser} disabled={inviting || !invitePassword || invitePassword.length < 6}>
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
