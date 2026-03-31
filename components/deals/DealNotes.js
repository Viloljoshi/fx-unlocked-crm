'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { MessageSquare, Send } from 'lucide-react'

export default function DealNotes({ dealId, notes = [], onNoteAdded }) {
  const [content, setContent] = useState('')
  const [noteType, setNoteType] = useState('GENERAL')
  const [submitting, setSubmitting] = useState(false)

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
              <div className="flex items-center justify-between mb-1">
                <span className="font-medium text-xs uppercase tracking-wide">{note.note_type}</span>
                <span className="text-xs text-muted-foreground">
                  {new Date(note.created_at).toLocaleDateString('en-US', {
                    month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit',
                  })}
                </span>
              </div>
              <p className="text-foreground">{note.content}</p>
              {note.user && (
                <p className="text-xs text-muted-foreground mt-1">
                  — {note.user.first_name} {note.user.last_name}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
