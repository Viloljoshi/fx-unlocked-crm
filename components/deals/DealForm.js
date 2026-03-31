'use client'

import { useState, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import RebateStructure from './RebateStructure'
import DealTypeFields from '@/components/deal-type-fields/DealTypeFields'

export default function DealForm({ deal, onSave, onCancel, mode = 'create' }) {
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [affiliates, setAffiliates] = useState([])
  const [brokers, setBrokers] = useState([])

  const [affiliateId, setAffiliateId] = useState(deal?.affiliate_id || '')
  const [brokerId, setBrokerId] = useState(deal?.broker_id || '')
  const [dealType, setDealType] = useState(deal?.deal_type || '')
  const [dealTerms, setDealTerms] = useState(deal?.deal_terms || '')
  const [dealDetails, setDealDetails] = useState(deal?.deal_details || {})
  const [levels, setLevels] = useState(deal?.deal_levels || [])
  const [rebateErrors, setRebateErrors] = useState([])

  // Fetch affiliates and brokers
  useEffect(() => {
    async function loadData() {
      setLoading(true)
      const [affRes, brokerRes] = await Promise.all([
        supabase.from('affiliates').select('id, name, email, status, deal_type').order('name'),
        supabase.from('brokers').select('id, name').eq('is_active', true).order('name'),
      ])
      setAffiliates(affRes.data || [])
      setBrokers(brokerRes.data || [])
      setLoading(false)
    }
    loadData()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-fill deal_type from selected affiliate
  useEffect(() => {
    if (affiliateId && !deal) {
      const aff = affiliates.find((a) => a.id === affiliateId)
      if (aff?.deal_type && !dealType) {
        setDealType(aff.deal_type)
      }
    }
  }, [affiliateId, affiliates]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = async (asDraft = false) => {
    if (!affiliateId) {
      toast.error('Please select an Affiliate / IB')
      return
    }
    if (!dealType) {
      toast.error('Please select a Deal Type')
      return
    }
    if (rebateErrors.length > 0) {
      toast.error('Fix rebate structure errors before saving')
      return
    }

    setSaving(true)
    try {
      const payload = {
        affiliate_id: affiliateId,
        broker_id: brokerId || null,
        deal_type: dealType,
        deal_terms: dealTerms || null,
        deal_details: dealDetails,
        levels,
        status: asDraft ? 'DRAFT' : undefined,
      }

      if (onSave) await onSave(payload)
    } catch (err) {
      toast.error(err.message || 'Failed to save deal')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Step 1: Select Affiliate */}
      <Card>
        <CardContent className="pt-6 space-y-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Affiliate & Broker</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Affiliate / IB *</Label>
              <Select value={affiliateId} onValueChange={setAffiliateId} disabled={mode === 'edit'}>
                <SelectTrigger>
                  <SelectValue placeholder="Select affiliate..." />
                </SelectTrigger>
                <SelectContent>
                  {affiliates.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name} ({a.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Broker</Label>
              <Select value={brokerId} onValueChange={setBrokerId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select broker..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">No broker</SelectItem>
                  {brokers.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Deal Type *</Label>
              <Select value={dealType} onValueChange={setDealType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select deal type..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CPA">CPA</SelectItem>
                  <SelectItem value="PNL">PNL</SelectItem>
                  <SelectItem value="HYBRID">HYBRID</SelectItem>
                  <SelectItem value="REBATES">REBATES</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Deal Terms</Label>
              <Textarea
                value={dealTerms}
                onChange={(e) => setDealTerms(e.target.value)}
                placeholder="General deal terms..."
                className="min-h-[80px]"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Step 2: Deal Type Specific Fields */}
      {dealType && (
        <Card>
          <CardContent className="pt-6 space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Deal Details — {dealType}</h3>
            <DealTypeFields
              dealType={dealType}
              dealData={dealDetails?.deal || {}}
              setDealData={(data) => setDealDetails((prev) => ({ ...prev, deal: typeof data === 'function' ? data(prev?.deal || {}) : data }))}
            />
          </CardContent>
        </Card>
      )}

      {/* Step 3: Rebate Structure (always shown, most important for REBATES/HYBRID) */}
      <Card>
        <CardContent className="pt-6">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-4">Rebate Structure</h3>
          <RebateStructure
            levels={levels}
            onChange={(newLevels, errors) => {
              setLevels(newLevels)
              setRebateErrors(errors || [])
            }}
            affiliates={affiliates}
          />
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 pt-2">
        {onCancel && (
          <Button variant="outline" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
        )}
        <Button variant="secondary" onClick={() => handleSubmit(true)} disabled={saving}>
          {saving ? 'Saving...' : 'Save as Draft'}
        </Button>
        <Button onClick={() => handleSubmit(false)} disabled={saving}>
          {saving ? 'Saving...' : mode === 'edit' ? 'Update Deal' : 'Create Deal'}
        </Button>
      </div>
    </div>
  )
}
