'use client'

import { useState } from 'react'
import { Clock, ArrowRight, Eye, RotateCcw, Trash2, X, ChevronDown, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'

function formatValue(val) {
  if (val === null || val === undefined) return 'empty'
  if (typeof val === 'object') {
    try { return JSON.stringify(val, null, 2) } catch { return String(val) }
  }
  return String(val)
}

function formatValueShort(val) {
  if (val === null || val === undefined) return 'empty'
  if (typeof val === 'object') {
    const str = JSON.stringify(val)
    return str.length > 60 ? str.slice(0, 57) + '...' : str
  }
  return String(val)
}

const actionColors = {
  CREATED: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  UPDATED: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  SENT_FOR_APPROVAL: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  APPROVED: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  REJECTED: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
}

export default function DealHistory({ versions = [], dealId, onRestore }) {
  const [viewVersion, setViewVersion] = useState(null)
  const [deleteVersion, setDeleteVersion] = useState(null)
  const [restoreVersion, setRestoreVersion] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [restoring, setRestoring] = useState(false)

  async function handleDelete(versionId) {
    setDeleting(true)
    try {
      const res = await fetch(`/api/deals/${dealId}/versions/${versionId}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to delete version')
      }
      toast.success('Version deleted')
      setDeleteVersion(null)
      if (onRestore) onRestore()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setDeleting(false)
    }
  }

  async function handleRestore(version) {
    setRestoring(true)
    try {
      const res = await fetch(`/api/deals/${dealId}/versions/${version.id}/restore`, { method: 'POST' })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to restore version')
      }
      toast.success(`Restored to v${version.version_number}`)
      setRestoreVersion(null)
      if (onRestore) onRestore()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setRestoring(false)
    }
  }

  if (versions.length === 0) {
    return (
      <div className="text-sm text-muted-foreground text-center py-8">
        No version history available
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Clock className="w-4 h-4 text-muted-foreground" />
        <h3 className="text-sm font-medium">Version History</h3>
        <span className="text-xs text-muted-foreground">({versions.length} versions)</span>
      </div>

      <div className="relative">
        <div className="absolute left-[15px] top-2 bottom-2 w-px bg-border" />

        <div className="space-y-3">
          {versions.map((version, idx) => {
            const changes = version.changes || {}
            const action = changes.action || 'UPDATED'
            const isLatest = idx === 0
            const colorClass = actionColors[action] || actionColors.UPDATED
            const changeEntries = Object.entries(changes).filter(([key]) => key !== 'action' && key !== 'snapshot' && key !== 'restored_from' && key !== 'updates')
            const restoredFrom = changes.restored_from

            return (
              <div key={version.id} className="relative pl-10">
                <div className={`absolute left-[10px] top-3 w-[11px] h-[11px] rounded-full border-2 ${isLatest ? 'border-primary bg-primary' : 'border-muted-foreground/40 bg-background'}`} />

                <div className="border rounded-lg overflow-hidden">
                  {/* Header */}
                  <div className="flex items-center justify-between px-3 py-2 bg-muted/30">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="secondary" className="text-[10px] font-bold px-1.5 py-0">
                        v{version.version_number}
                      </Badge>
                      <span className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded ${colorClass}`}>
                        {action === 'RESTORED' ? `Restored to ${restoredFrom || '?'}` : action.replace(/_/g, ' ')}
                      </span>
                      {isLatest && (
                        <span className="text-[10px] font-medium text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                          CURRENT
                        </span>
                      )}
                      {version.changer && (
                        <span className="text-xs text-muted-foreground">
                          by {version.changer.first_name} {version.changer.last_name}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-muted-foreground mr-1">
                        {new Date(version.created_at).toLocaleDateString('en-US', {
                          month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                        })}
                      </span>
                      <Button variant="ghost" size="icon" className="h-6 w-6" title="View details" onClick={() => setViewVersion(version)}>
                        <Eye className="w-3 h-3" />
                      </Button>
                      {!isLatest && onRestore && (
                        <Button variant="ghost" size="icon" className="h-6 w-6" title="Restore this version" onClick={() => setRestoreVersion(version)}>
                          <RotateCcw className="w-3 h-3" />
                        </Button>
                      )}
                      {!isLatest && dealId && (
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive" title="Delete version" onClick={() => setDeleteVersion(version)}>
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Summary of changes */}
                  {changeEntries.length > 0 && (
                    <div className="px-3 py-2 space-y-0.5">
                      {changeEntries.slice(0, 3).map(([key, val]) => (
                        <div key={key} className="text-xs flex items-center gap-1.5">
                          <span className="font-medium text-foreground min-w-[80px]">{key.replace(/_/g, ' ')}</span>
                          {val?.from !== undefined && val?.to !== undefined ? (
                            <>
                              <span className="text-red-500/70 truncate max-w-[120px]">{formatValueShort(val.from)}</span>
                              <ArrowRight className="w-3 h-3 text-muted-foreground shrink-0" />
                              <span className="text-green-600 truncate max-w-[120px]">{formatValueShort(val.to)}</span>
                            </>
                          ) : (
                            <span className="text-muted-foreground truncate max-w-[200px]">{formatValueShort(val)}</span>
                          )}
                        </div>
                      ))}
                      {changeEntries.length > 3 && (
                        <button className="text-[10px] text-primary hover:underline" onClick={() => setViewVersion(version)}>
                          +{changeEntries.length - 3} more changes
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* View Version Dialog */}
      <Dialog open={!!viewVersion} onOpenChange={() => setViewVersion(null)}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Version {viewVersion?.version_number} Details</DialogTitle>
            <DialogDescription>
              {viewVersion?.changer ? `${viewVersion.changer.first_name} ${viewVersion.changer.last_name}` : 'Unknown'} — {viewVersion && new Date(viewVersion.created_at).toLocaleString()}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            {viewVersion && Object.entries(viewVersion.changes || {})
              .filter(([key]) => key !== 'action' && key !== 'snapshot')
              .map(([key, val]) => (
                <div key={key} className="border rounded-lg p-3">
                  <p className="text-xs font-semibold uppercase text-muted-foreground mb-1.5">{key.replace(/_/g, ' ')}</p>
                  {val?.from !== undefined && val?.to !== undefined ? (
                    <div className="space-y-1.5">
                      <div className="text-xs">
                        <span className="text-muted-foreground">Before: </span>
                        <pre className="inline-block bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400 px-2 py-1 rounded text-[11px] whitespace-pre-wrap break-all max-w-full">{formatValue(val.from)}</pre>
                      </div>
                      <div className="text-xs">
                        <span className="text-muted-foreground">After: </span>
                        <pre className="inline-block bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-400 px-2 py-1 rounded text-[11px] whitespace-pre-wrap break-all max-w-full">{formatValue(val.to)}</pre>
                      </div>
                    </div>
                  ) : (
                    <pre className="text-xs bg-muted/50 px-2 py-1 rounded whitespace-pre-wrap break-all">{formatValue(val)}</pre>
                  )}
                </div>
              ))}
            {viewVersion?.changes?.snapshot && (
              <div className="border rounded-lg p-3">
                <p className="text-xs font-semibold uppercase text-muted-foreground mb-1.5">Snapshot</p>
                <pre className="text-xs bg-muted/50 px-2 py-1 rounded whitespace-pre-wrap break-all max-h-[200px] overflow-y-auto">{formatValue(viewVersion.changes.snapshot)}</pre>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Restore Confirmation */}
      <AlertDialog open={!!restoreVersion} onOpenChange={() => setRestoreVersion(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore to v{restoreVersion?.version_number}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will revert the deal fields to the state captured in version {restoreVersion?.version_number}. A new version entry will be created to track this restore.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={restoring}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => handleRestore(restoreVersion)} disabled={restoring}>
              {restoring ? 'Restoring...' : 'Restore'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteVersion} onOpenChange={() => setDeleteVersion(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete v{deleteVersion?.version_number}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove this version history entry. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => handleDelete(deleteVersion.id)} disabled={deleting} className="bg-destructive hover:bg-destructive/90">
              {deleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
