'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Textarea } from '@/components/ui/textarea'
import {
  CheckSquare, Plus, Search, Trash2, Pencil, ChevronUp, ChevronDown,
  ChevronsUpDown, AlertCircle, Clock, CheckCircle2, XCircle,
  Flame, TrendingUp, Minus, ArrowUp, Calendar, User, Filter, X
} from 'lucide-react'
import { toast } from 'sonner'
import { useUserRole } from '@/lib/hooks/useUserRole'
import { cn } from '@/lib/utils'

// ── Constants ──────────────────────────────────────────────────────────────

const PRIORITY_CONFIG = {
  URGENT: {
    label: 'Urgent',
    icon: Flame,
    className: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-800',
    dotColor: 'bg-red-500',
    order: 1,
  },
  HIGH: {
    label: 'High',
    icon: ArrowUp,
    className: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/40 dark:text-orange-400 dark:border-orange-800',
    dotColor: 'bg-orange-500',
    order: 2,
  },
  MEDIUM: {
    label: 'Medium',
    icon: TrendingUp,
    className: 'bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-950/40 dark:text-yellow-400 dark:border-yellow-800',
    dotColor: 'bg-yellow-500',
    order: 3,
  },
  LOW: {
    label: 'Low',
    icon: Minus,
    className: 'bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800/40 dark:text-slate-400 dark:border-slate-700',
    dotColor: 'bg-slate-400',
    order: 4,
  },
}

const STATUS_CONFIG = {
  TODO: {
    label: 'To Do',
    icon: Clock,
    className: 'bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800/40 dark:text-slate-400 dark:border-slate-700',
    dotColor: 'bg-slate-400',
  },
  IN_PROGRESS: {
    label: 'In Progress',
    icon: AlertCircle,
    className: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-800',
    dotColor: 'bg-blue-500',
  },
  DONE: {
    label: 'Done',
    icon: CheckCircle2,
    className: 'bg-green-50 text-green-700 border-green-200 dark:bg-green-950/40 dark:text-green-400 dark:border-green-800',
    dotColor: 'bg-green-500',
  },
  BLOCKED: {
    label: 'Blocked',
    icon: XCircle,
    className: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-800',
    dotColor: 'bg-red-500',
  },
}

const EMPTY_FORM = {
  title: '',
  priority: 'MEDIUM',
  owner_id: '',
  deadline: '',
  status: 'TODO',
  description: '',
}

// ── Helpers ────────────────────────────────────────────────────────────────

function formatDeadline(dateStr) {
  if (!dateStr) return null
  const date = new Date(dateStr + 'T00:00:00')
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const diff = Math.floor((date - today) / (1000 * 60 * 60 * 24))

  const formatted = date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

  if (diff < 0) return { text: formatted, sub: `${Math.abs(diff)}d overdue`, urgent: true, overdue: true }
  if (diff === 0) return { text: formatted, sub: 'Due today', urgent: true, overdue: false }
  if (diff <= 3) return { text: formatted, sub: `${diff}d left`, urgent: true, overdue: false }
  return { text: formatted, sub: `${diff}d left`, urgent: false, overdue: false }
}

function getInitials(profile) {
  if (!profile) return '?'
  return `${(profile.first_name || '')[0] || ''}${(profile.last_name || '')[0] || ''}`.toUpperCase() || '?'
}

function fullName(profile) {
  if (!profile) return 'Unassigned'
  return `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || profile.email || 'Unknown'
}

// ── Sub-components ─────────────────────────────────────────────────────────

function PriorityBadge({ priority }) {
  const cfg = PRIORITY_CONFIG[priority] || PRIORITY_CONFIG.MEDIUM
  const Icon = cfg.icon
  return (
    <Badge variant="outline" className={cn('gap-1.5 font-medium text-xs border', cfg.className)}>
      <Icon className="w-3 h-3" />
      {cfg.label}
    </Badge>
  )
}

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.TODO
  const Icon = cfg.icon
  return (
    <Badge variant="outline" className={cn('gap-1.5 font-medium text-xs border', cfg.className)}>
      <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', cfg.dotColor)} />
      <Icon className="w-3 h-3" />
      {cfg.label}
    </Badge>
  )
}

function SortIcon({ field, sortField, sortDir }) {
  if (sortField !== field) return <ChevronsUpDown className="w-3.5 h-3.5 text-muted-foreground/40" />
  return sortDir === 'asc'
    ? <ChevronUp className="w-3.5 h-3.5 text-primary" />
    : <ChevronDown className="w-3.5 h-3.5 text-primary" />
}

function StatCard({ label, value, colorClass, icon: Icon }) {
  return (
    <Card className="glass-card border-border/50">
      <CardContent className="p-4 flex items-center gap-3">
        <div className={cn('p-2 rounded-lg', colorClass)}>
          <Icon className="w-4 h-4" />
        </div>
        <div>
          <p className="text-2xl font-bold font-outfit">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────

export default function TasksPage() {
  const { userId, role, loading: roleLoading } = useUserRole()
  const isAdmin = role === 'ADMIN'
  const supabase = createClient()

  const [tasks, setTasks] = useState([])
  const [staff, setStaff] = useState([])
  const [loading, setLoading] = useState(true)

  // filters & sort
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterPriority, setFilterPriority] = useState('all')
  const [filterOwner, setFilterOwner] = useState('all')
  const [sortField, setSortField] = useState('created_at')
  const [sortDir, setSortDir] = useState('desc')

  // dialog
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  // quick-edit status/priority inline
  const [quickEdit, setQuickEdit] = useState(null) // { id, field }

  // delete
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)

  // ── Data Loading ───────────────────────────────────────────────
  const loadData = useCallback(async () => {
    setLoading(true)
    const [tasksRes, staffRes] = await Promise.all([
      supabase
        .from('tasks')
        .select('*, owner:profiles!tasks_owner_id_fkey(id,first_name,last_name,email), creator:profiles!tasks_created_by_fkey(id,first_name,last_name)')
        .order('created_at', { ascending: false }),
      supabase.from('profiles').select('id,first_name,last_name,email').eq('is_active', true).order('first_name'),
    ])

    if (tasksRes.error) {
      // Fallback: join manually if FK alias fails
      const plain = await supabase.from('tasks').select('*').order('created_at', { ascending: false })
      setTasks(plain.data || [])
    } else {
      setTasks(tasksRes.data || [])
    }
    setStaff(staffRes.data || [])
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  // ── Computed Stats ─────────────────────────────────────────────
  const stats = useMemo(() => ({
    total: tasks.length,
    todo: tasks.filter(t => t.status === 'TODO').length,
    inProgress: tasks.filter(t => t.status === 'IN_PROGRESS').length,
    done: tasks.filter(t => t.status === 'DONE').length,
    blocked: tasks.filter(t => t.status === 'BLOCKED').length,
    urgent: tasks.filter(t => t.priority === 'URGENT').length,
    overdue: tasks.filter(t => {
      if (!t.deadline || t.status === 'DONE') return false
      return new Date(t.deadline) < new Date(new Date().toDateString())
    }).length,
  }), [tasks])

  // ── Filtered & Sorted Tasks ────────────────────────────────────
  const displayed = useMemo(() => {
    let rows = [...tasks]

    if (search) {
      const q = search.toLowerCase()
      rows = rows.filter(t =>
        t.title?.toLowerCase().includes(q) ||
        fullName(t.owner)?.toLowerCase().includes(q)
      )
    }
    if (filterStatus !== 'all') rows = rows.filter(t => t.status === filterStatus)
    if (filterPriority !== 'all') rows = rows.filter(t => t.priority === filterPriority)
    if (filterOwner !== 'all') rows = rows.filter(t => t.owner_id === filterOwner)

    rows.sort((a, b) => {
      let aVal, bVal
      if (sortField === 'priority') {
        aVal = PRIORITY_CONFIG[a.priority]?.order ?? 99
        bVal = PRIORITY_CONFIG[b.priority]?.order ?? 99
      } else if (sortField === 'deadline') {
        aVal = a.deadline ? new Date(a.deadline).getTime() : Infinity
        bVal = b.deadline ? new Date(b.deadline).getTime() : Infinity
      } else if (sortField === 'title') {
        aVal = a.title?.toLowerCase() || ''
        bVal = b.title?.toLowerCase() || ''
      } else {
        aVal = a[sortField] || ''
        bVal = b[sortField] || ''
      }
      if (aVal < bVal) return sortDir === 'asc' ? -1 : 1
      if (aVal > bVal) return sortDir === 'asc' ? 1 : -1
      return 0
    })

    return rows
  }, [tasks, search, filterStatus, filterPriority, filterOwner, sortField, sortDir])

  const hasActiveFilters = filterStatus !== 'all' || filterPriority !== 'all' || filterOwner !== 'all' || search

  // ── Sort Toggle ────────────────────────────────────────────────
  function toggleSort(field) {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir('asc') }
  }

  // ── Open Create/Edit Dialog ────────────────────────────────────
  function openCreate() {
    setEditing(null)
    setForm({ ...EMPTY_FORM, owner_id: userId || '' })
    setDialogOpen(true)
  }

  function openEdit(task) {
    setEditing(task)
    setForm({
      title: task.title || '',
      priority: task.priority || 'MEDIUM',
      owner_id: task.owner_id || '',
      deadline: task.deadline || '',
      status: task.status || 'TODO',
      description: task.description || '',
    })
    setDialogOpen(true)
  }

  // ── Save Task ──────────────────────────────────────────────────
  async function handleSave() {
    if (!form.title.trim()) { toast.error('Title is required'); return }
    setSaving(true)

    const payload = {
      title: form.title.trim(),
      priority: form.priority,
      owner_id: form.owner_id || null,
      deadline: form.deadline || null,
      status: form.status,
      description: form.description.trim() || null,
    }

    if (editing) {
      const { error } = await supabase.from('tasks').update(payload).eq('id', editing.id)
      if (error) { toast.error('Failed to update task'); setSaving(false); return }
      toast.success('Task updated')
    } else {
      const { error } = await supabase.from('tasks').insert({ ...payload, created_by: userId })
      if (error) { toast.error('Failed to create task'); setSaving(false); return }
      toast.success('Task created')
    }

    setSaving(false)
    setDialogOpen(false)
    loadData()
  }

  // ── Quick Inline Update ────────────────────────────────────────
  async function handleQuickUpdate(taskId, field, value) {
    const { error } = await supabase.from('tasks').update({ [field]: value }).eq('id', taskId)
    if (error) { toast.error('Update failed'); return }
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, [field]: value } : t))
    setQuickEdit(null)
    toast.success('Updated')
  }

  // ── Delete Task ────────────────────────────────────────────────
  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    const { error } = await supabase.from('tasks').delete().eq('id', deleteTarget.id)
    if (error) { toast.error('Failed to delete task'); setDeleting(false); return }
    toast.success('Task deleted')
    setDeleting(false)
    setDeleteTarget(null)
    loadData()
  }

  function clearFilters() {
    setSearch('')
    setFilterStatus('all')
    setFilterPriority('all')
    setFilterOwner('all')
  }

  // ── Render ─────────────────────────────────────────────────────

  if (roleLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 space-y-5 min-h-full">

      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-primary/10">
            <CheckSquare className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold font-outfit tracking-tight">Tasks</h1>
            <p className="text-sm text-muted-foreground">Track and manage team to-dos</p>
          </div>
        </div>
        <Button onClick={openCreate} className="gap-2 shadow-sm">
          <Plus className="w-4 h-4" />
          Add Task
        </Button>
      </div>

      {/* ── Stats Row ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Total Tasks" value={stats.total} colorClass="bg-primary/10 text-primary" icon={CheckSquare} />
        <StatCard label="In Progress" value={stats.inProgress} colorClass="bg-blue-100 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400" icon={AlertCircle} />
        <StatCard label="Urgent" value={stats.urgent} colorClass="bg-red-100 text-red-600 dark:bg-red-950/50 dark:text-red-400" icon={Flame} />
        <StatCard label="Overdue" value={stats.overdue} colorClass="bg-orange-100 text-orange-600 dark:bg-orange-950/50 dark:text-orange-400" icon={Calendar} />
      </div>

      {/* ── Filters ── */}
      <Card className="glass-card border-border/50">
        <CardContent className="p-3">
          <div className="flex flex-wrap items-center gap-2">
            {/* Search */}
            <div className="relative flex-1 min-w-[180px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search tasks or owner..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9 h-9 bg-background"
              />
            </div>

            {/* Status filter */}
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-36 h-9 bg-background">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Priority filter */}
            <Select value={filterPriority} onValueChange={setFilterPriority}>
              <SelectTrigger className="w-36 h-9 bg-background">
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priorities</SelectItem>
                {Object.entries(PRIORITY_CONFIG).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Owner filter */}
            <Select value={filterOwner} onValueChange={setFilterOwner}>
              <SelectTrigger className="w-40 h-9 bg-background">
                <SelectValue placeholder="Owner" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Owners</SelectItem>
                {staff.map(s => (
                  <SelectItem key={s.id} value={s.id}>{fullName(s)}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="h-9 gap-1.5 text-muted-foreground hover:text-foreground">
                <X className="w-3.5 h-3.5" />
                Clear
              </Button>
            )}

            <span className="ml-auto text-xs text-muted-foreground tabular-nums shrink-0">
              {displayed.length} task{displayed.length !== 1 ? 's' : ''}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* ── Table ── */}
      <Card className="glass-card border-border/50 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            {/* Header */}
            <thead>
              <tr className="border-b border-border/60 bg-muted/30">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground w-[36%]">
                  <button
                    onClick={() => toggleSort('title')}
                    className="flex items-center gap-1.5 hover:text-foreground transition-colors"
                  >
                    Title
                    <SortIcon field="title" sortField={sortField} sortDir={sortDir} />
                  </button>
                </th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground w-[12%]">
                  <button
                    onClick={() => toggleSort('priority')}
                    className="flex items-center gap-1.5 hover:text-foreground transition-colors"
                  >
                    Priority
                    <SortIcon field="priority" sortField={sortField} sortDir={sortDir} />
                  </button>
                </th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground w-[16%]">
                  <span className="flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5" />
                    Owner
                  </span>
                </th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground w-[15%]">
                  <button
                    onClick={() => toggleSort('deadline')}
                    className="flex items-center gap-1.5 hover:text-foreground transition-colors"
                  >
                    <Calendar className="w-3.5 h-3.5" />
                    Deadline
                    <SortIcon field="deadline" sortField={sortField} sortDir={sortDir} />
                  </button>
                </th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground w-[14%]">Status</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground w-[7%]">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-border/40">
              {loading && Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="animate-pulse">
                  {Array.from({ length: 6 }).map((_, j) => (
                    <td key={j} className="px-4 py-3.5">
                      <Skeleton className="h-4 w-full rounded" />
                    </td>
                  ))}
                </tr>
              ))}

              {!loading && displayed.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-16 text-center text-muted-foreground">
                    <div className="flex flex-col items-center gap-3">
                      <div className="p-4 rounded-full bg-muted/50">
                        <CheckSquare className="w-8 h-8 text-muted-foreground/40" />
                      </div>
                      <p className="font-medium">
                        {hasActiveFilters ? 'No tasks match your filters' : 'No tasks yet'}
                      </p>
                      <p className="text-sm">
                        {hasActiveFilters
                          ? <button onClick={clearFilters} className="text-primary hover:underline">Clear filters</button>
                          : 'Click "Add Task" to create your first task.'
                        }
                      </p>
                    </div>
                  </td>
                </tr>
              )}

              {!loading && displayed.map(task => {
                const dl = formatDeadline(task.deadline)
                const owner = task.owner || staff.find(s => s.id === task.owner_id)
                const initials = getInitials(owner)
                const isDone = task.status === 'DONE'

                return (
                  <tr
                    key={task.id}
                    className={cn(
                      'group hover:bg-muted/30 transition-colors',
                      isDone && 'opacity-60'
                    )}
                  >
                    {/* Title */}
                    <td className="px-4 py-3.5">
                      <div className="flex flex-col gap-0.5">
                        <span className={cn('font-medium leading-snug', isDone && 'line-through text-muted-foreground')}>
                          {task.title}
                        </span>
                        {task.description && (
                          <span className="text-xs text-muted-foreground truncate max-w-[260px]">
                            {task.description}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Priority — click to change inline */}
                    <td className="px-4 py-3.5">
                      {quickEdit?.id === task.id && quickEdit?.field === 'priority' ? (
                        <Select
                          defaultValue={task.priority}
                          onValueChange={v => handleQuickUpdate(task.id, 'priority', v)}
                          open
                          onOpenChange={open => !open && setQuickEdit(null)}
                        >
                          <SelectTrigger className="h-7 w-28 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(PRIORITY_CONFIG).map(([k, v]) => (
                              <SelectItem key={k} value={k}>{v.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <button
                          onClick={() => setQuickEdit({ id: task.id, field: 'priority' })}
                          className="hover:opacity-80 transition-opacity"
                          title="Click to change priority"
                        >
                          <PriorityBadge priority={task.priority} />
                        </button>
                      )}
                    </td>

                    {/* Owner */}
                    <td className="px-4 py-3.5">
                      {owner ? (
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-primary/10 text-primary text-xs font-semibold flex items-center justify-center shrink-0 ring-1 ring-primary/20">
                            {initials}
                          </div>
                          <span className="text-sm truncate">{fullName(owner)}</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-xs italic">Unassigned</span>
                      )}
                    </td>

                    {/* Deadline */}
                    <td className="px-4 py-3.5">
                      {dl ? (
                        <div className="flex flex-col gap-0.5">
                          <span className={cn('text-sm font-medium', dl.overdue && 'text-red-600 dark:text-red-400')}>
                            {dl.text}
                          </span>
                          <span className={cn(
                            'text-[11px]',
                            dl.overdue ? 'text-red-500 dark:text-red-400 font-semibold' :
                            dl.urgent ? 'text-orange-500 dark:text-orange-400 font-semibold' :
                            'text-muted-foreground'
                          )}>
                            {dl.sub}
                          </span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-xs italic">No deadline</span>
                      )}
                    </td>

                    {/* Status — click to change inline */}
                    <td className="px-4 py-3.5">
                      {quickEdit?.id === task.id && quickEdit?.field === 'status' ? (
                        <Select
                          defaultValue={task.status}
                          onValueChange={v => handleQuickUpdate(task.id, 'status', v)}
                          open
                          onOpenChange={open => !open && setQuickEdit(null)}
                        >
                          <SelectTrigger className="h-7 w-32 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                              <SelectItem key={k} value={k}>{v.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <button
                          onClick={() => setQuickEdit({ id: task.id, field: 'status' })}
                          className="hover:opacity-80 transition-opacity"
                          title="Click to change status"
                        >
                          <StatusBadge status={task.status} />
                        </button>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3.5">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => openEdit(task)}
                          title="Edit task"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        {(isAdmin || task.created_by === userId) && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={() => setDeleteTarget(task)}
                            title="Delete task"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        {!loading && tasks.length > 0 && (
          <div className="border-t border-border/40 px-4 py-2.5 flex items-center gap-4 text-xs text-muted-foreground bg-muted/20">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-slate-400 inline-block" /> To Do: {stats.todo}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" /> In Progress: {stats.inProgress}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-green-500 inline-block" /> Done: {stats.done}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> Blocked: {stats.blocked}
            </span>
          </div>
        )}
      </Card>

      {/* ── Create / Edit Dialog ── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-outfit">
              <CheckSquare className="w-5 h-5 text-primary" />
              {editing ? 'Edit Task' : 'New Task'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-1">
            {/* Title */}
            <div className="space-y-1.5">
              <Label htmlFor="title">Title <span className="text-destructive">*</span></Label>
              <Input
                id="title"
                placeholder="What needs to be done?"
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                autoFocus
              />
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Add details or context..."
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                rows={2}
                className="resize-none"
              />
            </div>

            {/* Priority & Status row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Priority</Label>
                <Select value={form.priority} onValueChange={v => setForm(f => ({ ...f, priority: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(PRIORITY_CONFIG).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Owner & Deadline row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Owner</Label>
                <Select value={form.owner_id || 'none'} onValueChange={v => setForm(f => ({ ...f, owner_id: v === 'none' ? '' : v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Assign to..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Unassigned</SelectItem>
                    {staff.map(s => (
                      <SelectItem key={s.id} value={s.id}>{fullName(s)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="deadline">Deadline</Label>
                <Input
                  id="deadline"
                  type="date"
                  value={form.deadline}
                  onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))}
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving} className="gap-2">
              {saving ? 'Saving...' : editing ? 'Update Task' : 'Create Task'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirmation ── */}
      <AlertDialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Task?</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="font-medium text-foreground">"{deleteTarget?.title}"</span> will be permanently deleted. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive hover:bg-destructive/90"
            >
              {deleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
