'use client'

import DealStatusBadge from './DealStatusBadge'

export default function DealSummary({ deal }) {
  if (!deal) return null

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
      <div>
        <p className="text-xs text-muted-foreground">Affiliate / IB</p>
        <p className="text-sm font-medium">{deal.affiliate?.name || 'N/A'}</p>
      </div>
      <div>
        <p className="text-xs text-muted-foreground">Email</p>
        <p className="text-sm">{deal.affiliate?.email || 'N/A'}</p>
      </div>
      <div>
        <p className="text-xs text-muted-foreground">Broker</p>
        <p className="text-sm font-medium">{deal.broker?.name || 'N/A'}</p>
      </div>
      <div>
        <p className="text-xs text-muted-foreground">Deal Type</p>
        <p className="text-sm font-medium">{deal.deal_type}</p>
      </div>
      <div>
        <p className="text-xs text-muted-foreground">Status</p>
        <DealStatusBadge status={deal.status} />
      </div>
      <div>
        <p className="text-xs text-muted-foreground">Created</p>
        <p className="text-sm">
          {new Date(deal.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
        </p>
      </div>
      {deal.deal_terms && (
        <div className="col-span-2 md:col-span-3">
          <p className="text-xs text-muted-foreground">Deal Terms</p>
          <p className="text-sm">{deal.deal_terms}</p>
        </div>
      )}
      {deal.approved_at && (
        <div>
          <p className="text-xs text-muted-foreground">Approved At</p>
          <p className="text-sm">
            {new Date(deal.approved_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
      )}
      {deal.creator && (
        <div>
          <p className="text-xs text-muted-foreground">Created By</p>
          <p className="text-sm">{deal.creator.first_name} {deal.creator.last_name}</p>
        </div>
      )}
    </div>
  )
}
