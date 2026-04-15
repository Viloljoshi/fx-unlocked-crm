'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Plus, Trash2, Handshake } from 'lucide-react'

const DEAL_TYPES = ['CPA', 'PNL', 'HYBRID', 'REBATES']
const DEAL_TYPE_COLORS = {
  CPA: 'bg-blue-50 text-blue-700 border-blue-200',
  PNL: 'bg-purple-50 text-purple-700 border-purple-200',
  HYBRID: 'bg-green-50 text-green-700 border-green-200',
  REBATES: 'bg-yellow-50 text-yellow-700 border-yellow-200',
}

const EMPTY_DEAL = {
  id: null,        // null = new deal, UUID = existing deal
  broker_id: '',
  deal_type: '',
  deal_notes: '',
  status: 'ACTIVE',
}

/**
 * InlineDeals — manages multiple deals within the affiliate create/edit form.
 *
 * @param {{ deals: Array, brokers: Array, onChange: (deals: Array) => void, readOnly?: boolean }} props
 */
export default function InlineDeals({ deals = [], brokers = [], onChange, readOnly = false }) {
  const addDeal = () => {
    const updated = [...deals, { ...EMPTY_DEAL, _key: Date.now() }]
    onChange(updated)
  }

  const removeDeal = (index) => {
    const updated = deals.filter((_, i) => i !== index)
    onChange(updated)
  }

  const updateDeal = (index, field, value) => {
    const updated = deals.map((d, i) =>
      i === index ? { ...d, [field]: value } : d
    )
    onChange(updated)
  }

  if (readOnly) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Handshake className="w-4 h-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Deals ({deals.length})</h3>
        </div>
        {deals.length === 0 ? (
          <p className="text-xs text-muted-foreground">No deals configured.</p>
        ) : (
          <div className="grid gap-2">
            {deals.map((deal, i) => {
              const brokerName = brokers.find(b => b.id === deal.broker_id)?.name || 'No Broker'
              return (
                <Card key={deal.id || deal._key || i} className="border-dashed">
                  <CardContent className="py-3 px-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge className={DEAL_TYPE_COLORS[deal.deal_type] || ''}>
                          {deal.deal_type || 'No Type'}
                        </Badge>
                        <span className="text-sm font-medium">{brokerName}</span>
                      </div>
                      {deal.status && (
                        <Badge variant="outline" className="text-xs">{deal.status}</Badge>
                      )}
                    </div>
                    {deal.deal_notes && (
                      <p className="text-xs text-muted-foreground mt-1.5">{deal.deal_notes}</p>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="col-span-2 space-y-3 pt-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Handshake className="w-4 h-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Deals</h3>
          {deals.length > 0 && (
            <Badge variant="outline" className="text-xs">{deals.length}</Badge>
          )}
        </div>
      </div>

      {deals.length === 0 && (
        <p className="text-xs text-muted-foreground">
          No deals yet. Add a deal to link this partner to a broker with a specific deal type.
        </p>
      )}

      <div className="space-y-3">
        {deals.map((deal, index) => {
          const brokerName = brokers.find(b => b.id === deal.broker_id)?.name
          return (
            <Card key={deal.id || deal._key || index} className="border-l-4 border-l-primary/30">
              <CardHeader className="pb-2 pt-3 px-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Deal {index + 1}
                    {brokerName && deal.deal_type && (
                      <span className="ml-2 normal-case tracking-normal text-foreground">
                        — {deal.deal_type} · {brokerName}
                      </span>
                    )}
                  </CardTitle>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-muted-foreground hover:text-destructive"
                    onClick={() => removeDeal(index)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="px-4 pb-3 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Broker</Label>
                    <Select
                      value={deal.broker_id || '__none__'}
                      onValueChange={v => updateDeal(index, 'broker_id', v === '__none__' ? '' : v)}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Select broker..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">No Broker</SelectItem>
                        {brokers.map(b => (
                          <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Deal Type</Label>
                    <Select
                      value={deal.deal_type || '__none__'}
                      onValueChange={v => updateDeal(index, 'deal_type', v === '__none__' ? '' : v)}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Select type..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">None</SelectItem>
                        {DEAL_TYPES.map(d => (
                          <SelectItem key={d} value={d}>{d}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Deal Notes</Label>
                  <Textarea
                    value={deal.deal_notes || ''}
                    onChange={e => updateDeal(index, 'deal_notes', e.target.value)}
                    placeholder="Notes about this deal arrangement..."
                    className="min-h-[60px] text-xs"
                  />
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-full border-dashed"
        onClick={addDeal}
      >
        <Plus className="w-3.5 h-3.5 mr-1.5" /> Add Deal
      </Button>
    </div>
  )
}
