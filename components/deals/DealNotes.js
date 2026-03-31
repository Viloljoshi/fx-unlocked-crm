'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { toast } from 'sonner'
import { MessageSquare, Send, Pencil, Trash2, Check, X } from 'lucide-react'

export default function DealNotes({ dealId, notes = [], onNoteAdded, onNotesChanged }) {
  const [content, setContent] = useState('')
  const [noteType, setNoteType] = useState('GENERAL')
  const [submitting, setSubmitting] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [editContent, setEditContent] = useState('')
  const [editType, setEditType] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleteNote, setDeleteNote] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const handleSubmit = async () => {
    if (!content.trim()) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/deals/${dealId}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: content.trim(), note_type: noteType }),
      })
      if (res.ok) {
        const data = await res.json()
        setContent('')
        setNoteType('GENERAL')
        if (onNoteAdded) onNoteAdded(data.note)
        toast.success('Note added')
      } else {
        const errData = await res.json().catch(() => ({}))
        toast.error(errData.error || 'Failed to add note')
      }
    } catch (err) {
      console.error('Error adding note:', err)
      toast.error('Failed to add note')
    } finally {
      setSubmitting(false)
    }
  }

  const startEdit = (note) => {
    setEditingId(note.id)
    setEditContent(note.content)
    setEditType(note.note_type)
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditContent('')
    setEditType('')
  }

  const handleEdit = async (noteId) => {
    if (!editContent.trim()) return
    setSaving(true)
    try {
      const res = await fetch(`/api/deals/${dealId}/notes/${noteId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: editContent.trim(), note_type: editType }),
      })
      if (res.ok) {
        toast.success('Note updated')
        cancelEdit()
        if (onNotesChanged) onNotesChanged()
      } else {
        const errData = await res.json().catch(() => ({}))
        toast.error(errData.error || 'Failed to update note')
      }
    } catch (err) {
      toast.error('Failed to update note')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (noteId) => {
    setDeleting(true)
    try {
      const res = await fetch(`/api/deals/${dealId}/notes/${noteId}`, { method: 'DELETE' })
      if (res.ok) {
        toast.success('Note deleted')
        setDeleteNote(null)
        if (onNotesChanged) onNotesChanged()
      } else {
        const errData = await res.json().catch(() => ({}))
        toast.error(errData.error || 'Failed to delete note')
      }
    } catch (err) {
      toast.error('Failed to delete note')
    } finally {
      setDeleting(false)
    }
  }

  const noteTypeColors = {
    GENERAL: 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800',
    INTERNAL: 'bg-purple-50 dark:bg-purple-950/30 border-purple-200 dark:border-purple-800',
    APPROVAL: 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800',
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <MessageSquare className="w-4 h-4 text-muted-foreground" />
        <h3 className="text-sm font-medium">Notes</h3>
      </div>

      {/* Add note form */}
      <div className="space-y-2">
        <div className="flex gap-2">
          <Select value={noteType} onValueChange={setNoteType}>
            <SelectTrigger className="w-[130px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="GENERAL">General</SelectItem>
              <SelectItem value="INTERNAL">Internal</SelectItem>
              <SelectItem value="APPROVAL">Approval</SelectItem>
            </SelectContent>
          </Select>
          <Textarea
            placeholder="Add a note..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="min-h-[60px] flex-1"
          />
        </div>
        <div className="flex justify-end">
          <Button size="sm" onClick={handleSubmit} disabled={!content.trim() || submitting}>
            <Send className="w-3.5 h-3.5 mr-1.5" />
            {submitting ? 'Adding...' : 'Add Note'}
          </Button>
        </div>
      </div>

      {/* Notes list */}
      {notes.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">No notes yet</p>
      ) : (
        <div className="space-y-2 max-h-[400px] overflow-y-auto">
          {notes.map((note) => (
            <div
              key={note.id}
              className={`border rounded-lg p-3 text-sm ${noteTypeColors[note.note_type] || noteTypeColors.GENERAL}`}
            >
              {editingId === note.id ? (
                /* Edit mode */
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <Select value={editType} onValueChange={setEditType}>
                      <SelectTrigger className="w-[120px] h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="GENERAL">General</SelectItem>
                        <SelectItem value="INTERNAL">Internal</SelectItem>
                        <SelectItem value="APPROVAL">Approval</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    className="min-h-[50px] text-sm"
                  />
                  <div className="flex justify-end gap-1.5">
                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={cancelEdit} disabled={saving}>
                      <X className="w-3 h-3 mr-1" /> Cancel
                    </Button>
                    <Button size="sm" className="h-7 text-xs" onClick={() => handleEdit(note.id)} disabled={!editContent.trim() || saving}>
                      <Check className="w-3 h-3 mr-1" /> {saving ? 'Saving...' : 'Save'}
                    </Button>
                  </div>
                </div>
              ) : (
                /* View mode */
                <>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-xs uppercase tracking-wide">{note.note_type}</span>
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-muted-foreground mr-1">
                        {new Date(note.created_at).toLocaleDateString('en-US', {
                          month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit',
                        })}
                      </span>
                      <Button variant="ghost" size="icon" className="h-6 w-6" title="Edit" onClick={() => startEdit(note)}>
                        <Pencil className="w-3 h-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive" title="Delete" onClick={() => setDeleteNote(note)}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                  <p className="text-foreground">{note.content}</p>
                  {note.user && (
                    <p className="text-xs text-muted-foreground mt-1">
                      — {note.user.first_name} {note.user.last_name}
                    </p>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteNote} onOpenChange={() => setDeleteNote(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this note?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove this note. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => handleDelete(deleteNote.id)} disabled={deleting} className="bg-destructive hover:bg-destructive/90">
              {deleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
