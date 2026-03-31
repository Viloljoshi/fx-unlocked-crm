'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Plus, Trash2 } from 'lucide-react'

const MAX_TIERS = 5

// ── Shared sub-fields ────────────────────────────────────────────────────────

function StartDateField({ value, onChange, readOnly }) {
  return (
    <div className="space-y-1.5">
      <Label>Start Date</Label>
      {readOnly ? (
        <p className="text-sm font-medium">{value ? new Date(value).toLocaleDateString() : '-'}</p>
      ) : (
        <Input type="date" value={value || ''} onChange={e => onChange(e.target.value)} />
      )}
    </div>
  )
}

function DealNotesField({ value, onChange, readOnly }) {
  return (
    <div className="space-y-1.5">
      <Label>Deal Notes</Label>
      {readOnly ? (
        <p className="text-sm font-medium whitespace-pre-wrap">{value || '-'}</p>
      ) : (
        <Textarea
          value={value || ''}
          onChange={e => onChange(e.target.value)}
          placeholder="Special terms, conditions, negotiation history..."
          className="min-h-[80px] text-sm"
        />
      )}
    </div>
  )
}

function NetDepositsField({ value, onChange, readOnly }) {
  return (
    <div className="space-y-1.5">
      <Label>Net Deposits per Month ($)</Label>
      {readOnly ? (
        <p className="text-sm font-medium">{value ? `$${Number(value).toLocaleString()}` : '-'}</p>
      ) : (
        <Input type="number" min="0" value={value || ''} onChange={e => onChange(e.target.value)} placeholder="e.g. 50000" />
      )}
    </div>
  )
}

function ExpectedVolumeField({ value, onChange, readOnly }) {
  return (
    <div className="space-y-1.5">
      <Label>Expected Volume per Month (Lots)</Label>
      {readOnly ? (
        <p className="text-sm font-medium">{value ? Number(value).toLocaleString() : '-'}</p>
      ) : (
        <Input type="number" min="0" value={value || ''} onChange={e => onChange(e.target.value)} placeholder="e.g. 200" />
      )}
    </div>
  )
}

// ── CPA Tiers ────────────────────────────────────────────────────────────────

function CPATiers({ tiers = [], onChange, readOnly }) {
  const addTier = () => {
    if (tiers.length >= MAX_TIERS) return
    onChange([...tiers, { deposit_amount: '', cpa_amount: '' }])
  }

  const removeTier = (idx) => {
    onChange(tiers.filter((_, i) => i !== idx))
  }

  const updateTier = (idx, key, val) => {
    const updated = tiers.map((t, i) => i === idx ? { ...t, [key]: val } : t)
    onChange(updated)
  }

  return (
    <div className="space-y-2">
      <Label>CPA Tiers</Label>
      {readOnly ? (
        tiers.length > 0 ? (
          <div className="space-y-1">
            {tiers.map((t, i) => (
              <div key={i} className="flex items-center gap-3 text-sm bg-muted/30 rounded-md px-3 py-1.5">
                <span className="text-muted-foreground text-xs w-14">Tier {i + 1}</span>
                <span>Deposit: <strong>${Number(t.deposit_amount || 0).toLocaleString()}</strong></span>
                <span className="text-muted-foreground">→</span>
                <span>CPA: <strong>${Number(t.cpa_amount || 0).toLocaleString()}</strong></span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No tiers set</p>
        )
      ) : (
        <>
          {tiers.map((tier, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground w-10 shrink-0">Tier {idx + 1}</span>
              <Input
                type="number" min="0" placeholder="Deposit $"
                value={tier.deposit_amount || ''}
                onChange={e => updateTier(idx, 'deposit_amount', e.target.value)}
                className="flex-1"
              />
              <Input
                type="number" min="0" placeholder="CPA $"
                value={tier.cpa_amount || ''}
                onChange={e => updateTier(idx, 'cpa_amount', e.target.value)}
                className="flex-1"
              />
              <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                onClick={() => removeTier(idx)}>
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          ))}
          {tiers.length < MAX_TIERS && (
            <Button type="button" variant="outline" size="sm" className="w-full text-xs" onClick={addTier}>
              <Plus className="w-3.5 h-3.5 mr-1" /> Add Tier {tiers.length > 0 ? `(${tiers.length}/${MAX_TIERS})` : ''}
            </Button>
          )}
        </>
      )}
    </div>
  )
}

// ── Rebates per Lot (single section) ─────────────────────────────────────────

function RebatesPerLot({ label = 'Rebates per Lot', data = {}, onChange, readOnly, accent }) {
  const update = (key, val) => onChange({ ...data, [key]: val })

  if (readOnly) {
    return (
      <div className="space-y-1.5">
        <Label>{label}</Label>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
          <div><span className="text-muted-foreground text-xs">Forex:</span> <strong>{data.forex || '-'}</strong></div>
          <div><span className="text-muted-foreground text-xs">Gold:</span> <strong>{data.gold || '-'}</strong></div>
          <div><span className="text-muted-foreground text-xs">Crypto:</span> <strong>{data.crypto || '-'}</strong></div>
          <div><span className="text-muted-foreground text-xs">Other:</span> <strong>{data.other || '-'}</strong></div>
        </div>
      </div>
    )
  }

  return (
    <div className={`space-y-2 rounded-lg border p-3 ${accent || ''}`}>
      <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</Label>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Forex</Label>
          <Input type="number" min="0" step="0.01" value={data.forex || ''} onChange={e => update('forex', e.target.value)} placeholder="$/lot" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Gold</Label>
          <Input type="number" min="0" step="0.01" value={data.gold || ''} onChange={e => update('gold', e.target.value)} placeholder="$/lot" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Crypto</Label>
          <Input type="number" min="0" step="0.01" value={data.crypto || ''} onChange={e => update('crypto', e.target.value)} placeholder="$/lot" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Other</Label>
          <Input value={data.other || ''} onChange={e => update('other', e.target.value)} placeholder="Text..." />
        </div>
      </div>
    </div>
  )
}

// ── Main Component ───────────────────────────────────────────────────────────

export default function DealTypeFields({ dealType, dealData = {}, onChange, readOnly = false }) {
  if (!dealType) return null

  const update = (key, val) => onChange({ ...dealData, [key]: val })

  const isCPA = dealType === 'CPA'
  const isRebates = dealType === 'REBATES'
  const isPnL = dealType === 'PNL'
  const isHybrid = dealType === 'HYBRID'

  return (
    <div className="col-span-2 space-y-4 border-t pt-4 mt-2">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        {dealType} Deal Fields
      </p>

      {/* ── CPA (pure) ────────────────────────────────────────────── */}
      {isCPA && (
        <>
          <div className="space-y-1.5">
            <Label>FTDs per Month</Label>
            {readOnly ? (
              <p className="text-sm font-medium">{dealData.ftds_per_month || '-'}</p>
            ) : (
              <Input type="number" min="0" value={dealData.ftds_per_month || ''} onChange={e => update('ftds_per_month', e.target.value)} placeholder="e.g. 50" />
            )}
          </div>
          <CPATiers tiers={dealData.cpa_tiers || []} onChange={val => update('cpa_tiers', val)} readOnly={readOnly} />
          <div className="space-y-1.5">
            <Label>Expected ROI</Label>
            {readOnly ? (
              <p className="text-sm font-medium">{dealData.expected_roi || '-'}</p>
            ) : (
              <Input type="number" min="0" step="0.1" value={dealData.expected_roi || ''} onChange={e => update('expected_roi', e.target.value)} placeholder="e.g. 1.5" />
            )}
          </div>
        </>
      )}

      {/* ── Rebates (pure) ────────────────────────────────────────── */}
      {isRebates && (
        <>
          <NetDepositsField value={dealData.net_deposits_per_month} onChange={val => update('net_deposits_per_month', val)} readOnly={readOnly} />
          <ExpectedVolumeField value={dealData.expected_volume_per_month} onChange={val => update('expected_volume_per_month', val)} readOnly={readOnly} />
          <div className="space-y-3">
            {readOnly && <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Rebates per Lot</Label>}
            <RebatesPerLot
              label="IB Deal"
              data={dealData.ib_deal || dealData.rebates_per_lot || {}}
              onChange={val => update('ib_deal', val)}
              readOnly={readOnly}
              accent="bg-blue-50/50 border-blue-100"
            />
            <RebatesPerLot
              label="FX Unlocked Earnings"
              data={dealData.fx_unlocked_earnings || {}}
              onChange={val => update('fx_unlocked_earnings', val)}
              readOnly={readOnly}
              accent="bg-purple-50/50 border-purple-100"
            />
          </div>
        </>
      )}

      {/* ── PnL ───────────────────────────────────────────────────── */}
      {isPnL && (
        <>
          <NetDepositsField value={dealData.net_deposits_per_month} onChange={val => update('net_deposits_per_month', val)} readOnly={readOnly} />
          <div className="space-y-1.5">
            <Label>PnL Deal Needed</Label>
            {readOnly ? (
              <p className="text-sm font-medium">{dealData.pnl_deal_needed || '-'}</p>
            ) : (
              <Input value={dealData.pnl_deal_needed || ''} onChange={e => update('pnl_deal_needed', e.target.value)} placeholder="e.g. 30% of net P&L after costs" />
            )}
          </div>
        </>
      )}

      {/* ── Hybrid (CPA + Rebates) ────────────────────────────────── */}
      {/* Order: Net Deposits → Volume → CPA Tiers → IB Deal → FX Unlocked Earnings */}
      {isHybrid && (
        <>
          <NetDepositsField value={dealData.net_deposits_per_month} onChange={val => update('net_deposits_per_month', val)} readOnly={readOnly} />
          <ExpectedVolumeField value={dealData.expected_volume_per_month} onChange={val => update('expected_volume_per_month', val)} readOnly={readOnly} />
          <CPATiers tiers={dealData.cpa_tiers || []} onChange={val => update('cpa_tiers', val)} readOnly={readOnly} />
          <div className="space-y-3">
            {readOnly && <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Rebates per Lot</Label>}
            <RebatesPerLot
              label="IB Deal"
              data={dealData.ib_deal || dealData.rebates_per_lot || {}}
              onChange={val => update('ib_deal', val)}
              readOnly={readOnly}
              accent="bg-blue-50/50 border-blue-100"
            />
            <RebatesPerLot
              label="FX Unlocked Earnings"
              data={dealData.fx_unlocked_earnings || {}}
              onChange={val => update('fx_unlocked_earnings', val)}
              readOnly={readOnly}
              accent="bg-purple-50/50 border-purple-100"
            />
          </div>
        </>
      )}

      {/* Shared: Deal Notes + Start Date (all deal types) */}
      <DealNotesField value={dealData.deal_notes} onChange={val => update('deal_notes', val)} readOnly={readOnly} />
      <StartDateField value={dealData.start_date} onChange={val => update('start_date', val)} readOnly={readOnly} />
    </div>
  )
}
