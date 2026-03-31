'use client'

import { Clock, ArrowRight } from 'lucide-react'

function formatValue(val) {
  if (val === null || val === undefined) return 'empty'
  if (typeof val === 'object') return JSON.stringify(val)
  return String(val)
}

export default function DealHistory({ versions = [] }) {
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
      </div>

      <div className="relative">
        {/* Timeline line */}
        <div className="absolute left-[15px] top-2 bottom-2 w-px bg-border" />

        <div className="space-y-4">
          {versions.map((version) => {
            const changes = version.changes || {}
            const action = changes.action || 'UPDATED'

            return (
              <div key={version.id} className="relative pl-10">
                {/* Timeline dot */}
                <div className="absolute left-[10px] top-2 w-[11px] h-[11px] rounded-full border-2 border-primary bg-background" />

                <div className="bg-muted/30 border rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded">
                        v{version.version_number}
                      </span>
                      <span className="text-xs font-medium uppercase text-muted-foreground">{action}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {new Date(version.created_at).toLocaleDateString('en-US', {
                        month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit',
                      })}
                    </span>
                  </div>

                  {version.changer && (
                    <p className="text-xs text-muted-foreground mb-2">
                      by {version.changer.first_name} {version.changer.last_name}
                    </p>
                  )}

                  {/* Show field changes */}
                  {Object.entries(changes)
                    .filter(([key]) => key !== 'action' && key !== 'snapshot')
                    .map(([key, val]) => (
                      <div key={key} className="text-xs flex items-center gap-1.5 py-0.5">
                        <span className="font-medium text-foreground">{key.replace(/_/g, ' ')}</span>
                        {val?.from !== undefined && val?.to !== undefined ? (
                          <>
                            <span className="text-red-500 line-through">{formatValue(val.from)}</span>
                            <ArrowRight className="w-3 h-3 text-muted-foreground" />
                            <span className="text-green-600">{formatValue(val.to)}</span>
                          </>
                        ) : (
                          <span className="text-muted-foreground">{formatValue(val)}</span>
                        )}
                      </div>
                    ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
