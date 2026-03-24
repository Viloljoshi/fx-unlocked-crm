'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Search, Plus, Users, Building2, DollarSign, Calendar, ArrowRight, Check, Loader2, Shield, StickyNote } from 'lucide-react'

const ENTITY_CONFIGS = {
  broker: {
    icon: Building2,
    label: 'Broker',
    table: 'brokers',
    fields: [
      { key: 'name', label: 'Broker Name', type: 'text', required: true },
      { key: 'account_manager', label: 'Account Manager', type: 'text' },
      { key: 'contact_email', label: 'Contact Email', type: 'text' },
      { key: 'contact_phone', label: 'Contact Phone', type: 'text' },
      { key: 'deal_types', label: 'Deal Types (CPA,REBATES,HYBRID,PNL)', type: 'text' },
      { key: 'notes', label: 'Notes', type: 'text' },
    ],
  },
  affiliate: {
    icon: Users,
    label: 'Affiliate',
    table: 'affiliates',
    fields: [
      { key: 'name', label: 'Name', type: 'text', required: true },
      { key: 'email', label: 'Email', type: 'text', required: true },
      { key: 'phone', label: 'Phone', type: 'text' },
      { key: 'broker_id', label: 'Broker (optional, add more from profile)', type: 'search', searchTable: 'brokers', searchField: 'name' },
      { key: 'manager_id', label: 'Manager', type: 'search', searchTable: 'profiles', searchField: 'first_name' },
      { key: 'master_ib_id', label: 'Master IB', type: 'search', searchTable: 'affiliates', searchField: 'name' },
      { key: 'deal_type', label: 'Deal Type', type: 'select', options: ['CPA', 'PNL', 'HYBRID', 'REBATES'] },
      { key: 'country', label: 'Country', type: 'text' },
      { key: 'status', label: 'Status', type: 'select', options: ['ACTIVE', 'ONBOARDING', 'LEAD', 'INACTIVE'] },
    ],
  },
  revenue: {
    icon: DollarSign,
    label: 'Revenue',
    table: 'commissions',
    fields: [
      { key: 'affiliate_id', label: 'Affiliate', type: 'search', searchTable: 'affiliates', searchField: 'name', required: true },
      { key: 'broker_id', label: 'Broker', type: 'search', searchTable: 'brokers', searchField: 'name' },
      { key: 'month', label: 'Month (1-12)', type: 'text', required: true },
      { key: 'year', label: 'Year', type: 'text', required: true },
      { key: 'deal_type', label: 'Deal Type', type: 'select', options: ['CPA', 'PNL', 'HYBRID', 'REBATES'], required: true },
      { key: 'revenue_amount', label: 'Revenue Amount ($)', type: 'text', required: true },
    ],
  },
  appointment: {
    icon: Calendar,
    label: 'Appointment',
    table: 'appointments',
    fields: [
      { key: 'affiliate_id', label: 'Affiliate', type: 'search', searchTable: 'affiliates', searchField: 'name', required: true },
      { key: 'title', label: 'Title', type: 'text', required: true },
      { key: 'appointment_type', label: 'Type', type: 'select', options: ['MEETING', 'CALL', 'FOLLOW_UP'], required: true },
      { key: 'scheduled_at', label: 'Date & Time (YYYY-MM-DD HH:MM)', type: 'text', required: true },
      { key: 'notes', label: 'Notes', type: 'text' },
    ],
  },
  note: {
    icon: StickyNote,
    label: 'Note',
    table: 'affiliate_notes',
    fields: [
      { key: 'affiliate_id', label: 'Affiliate', type: 'search', searchTable: 'affiliates', searchField: 'name', required: true },
      { key: 'note_type', label: 'Type', type: 'select', options: ['GENERAL', 'CALL', 'MEETING', 'EMAIL'], required: true },
      { key: 'content', label: 'Note Content', type: 'text', required: true },
    ],
  },
}

export default function CommandBar({ open, setOpen, userId }) {
  const [input, setInput] = useState('')
  const [mode, setMode] = useState('search')
  const [entityType, setEntityType] = useState(null)
  const [currentStep, setCurrentStep] = useState(0)
  const [formData, setFormData] = useState({})
  const [searchResults, setSearchResults] = useState([])
  const [suggestions, setSuggestions] = useState([])
  const [selectedSuggestion, setSelectedSuggestion] = useState(0)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const inputRef = useRef(null)
  const router = useRouter()
  const supabase = createClient()

  const reset = useCallback(() => {
    setInput('')
    setMode('search')
    setEntityType(null)
    setCurrentStep(0)
    setFormData({})
    setSearchResults([])
    setSuggestions([])
    setSelectedSuggestion(0)
  }, [])

  useEffect(() => {
    if (open) {
      reset()
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [open, reset])

  useEffect(() => {
    const down = (e) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen(prev => !prev)
      }
    }
    document.addEventListener('keydown', down)
    return () => document.removeEventListener('keydown', down)
  }, [setOpen])

  // Global search
  useEffect(() => {
    if (mode !== 'search' || !input || input.startsWith('@') || input.toLowerCase().startsWith('add')) return
    const timer = setTimeout(async () => {
      const q = input.toLowerCase()
      const [aff, brk, staff] = await Promise.all([
        supabase.from('affiliates').select('id, name, email, status').ilike('name', `%${q}%`).limit(5),
        supabase.from('brokers').select('id, name').ilike('name', `%${q}%`).limit(5),
        supabase.from('profiles').select('id, first_name, last_name, role').or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%`).limit(5),
      ])
      setSearchResults([
        ...(aff.data || []).map(a => ({ ...a, type: 'affiliate', href: `/dashboard/affiliates/${a.id}` })),
        ...(brk.data || []).map(b => ({ ...b, type: 'broker', href: '/dashboard/brokers' })),
        ...(staff.data || []).map(s => ({ ...s, name: `${s.first_name} ${s.last_name}`, type: 'staff', href: '/dashboard/staff' })),
      ])
    }, 300)
    return () => clearTimeout(timer)
  }, [input, mode, supabase])

  // Suggestions for search-type fields
  useEffect(() => {
    if (mode !== 'add' || !entityType) return
    const config = ENTITY_CONFIGS[entityType]
    const field = config.fields[currentStep]
    if (!field || field.type !== 'search' || !input) { setSuggestions([]); return }
    const timer = setTimeout(async () => {
      let query
      if (field.searchTable === 'profiles') {
        query = supabase.from(field.searchTable)
          .select(`id, ${field.searchField}, last_name`)
          .or(`first_name.ilike.%${input}%,last_name.ilike.%${input}%`)
          .limit(8)
      } else {
        query = supabase.from(field.searchTable)
          .select(`id, ${field.searchField}`)
          .ilike(field.searchField, `%${input}%`)
          .limit(8)
      }
      const { data } = await query
      setSuggestions((data || []).map(d => ({
        id: d.id,
        label: field.searchTable === 'profiles' ? `${d[field.searchField]} ${d.last_name || ''}`.trim() : d[field.searchField],
      })))
      setSelectedSuggestion(0)
    }, 200)
    return () => clearTimeout(timer)
  }, [input, mode, entityType, currentStep, supabase])

  const handleInputChange = (val) => {
    setInput(val)
    if (mode === 'search' && (val.startsWith('@') || val.toLowerCase() === 'add')) {
      setMode('entity-select')
    }
  }

  const selectEntity = (type) => {
    setEntityType(type)
    setMode('add')
    setInput('')
    setCurrentStep(0)
    setFormData({})
  }

  const advanceStep = (value) => {
    if (!entityType) return
    const config = ENTITY_CONFIGS[entityType]
    const field = config.fields[currentStep]
    const finalValue = value || input

    if (field.required && !finalValue) {
      toast.error(`${field.label} is required`)
      return
    }

    // Field-specific validations
    if (field.key === 'month') {
      const m = parseInt(finalValue)
      if (isNaN(m) || m < 1 || m > 12) { toast.error('Month must be between 1 and 12'); return }
    }
    if (field.key === 'year') {
      const y = parseInt(finalValue)
      if (isNaN(y) || y < 2020 || y > 2030) { toast.error('Year must be between 2020 and 2030'); return }
    }
    if (field.key === 'scheduled_at' && finalValue) {
      if (isNaN(new Date(finalValue).getTime())) { toast.error('Invalid date. Use format: YYYY-MM-DD HH:MM'); return }
    }
    if (field.key === 'revenue_amount' && finalValue) {
      const amt = parseFloat(finalValue)
      if (isNaN(amt) || amt <= 0) { toast.error('Amount must be a positive number'); return }
    }

    const newData = { ...formData, [field.key]: finalValue }
    setFormData(newData)
    setInput('')
    setSuggestions([])

    if (currentStep < config.fields.length - 1) {
      setCurrentStep(currentStep + 1)
    } else {
      submitForm(newData)
    }
  }

  const goBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
      const config = ENTITY_CONFIGS[entityType]
      const prevField = config.fields[currentStep - 1]
      setInput(formData[prevField.key] || '')
    } else {
      setMode('entity-select')
      setEntityType(null)
      setInput('@')
    }
  }

  const createAndAdvance = async (field, name) => {
    if (!name?.trim()) return
    setIsSubmitting(true)
    try {
      let newId
      if (field.searchTable === 'brokers') {
        const { data, error } = await supabase.from('brokers').insert({ name: name.trim(), is_active: true }).select('id').single()
        if (error) throw error
        newId = data.id
        toast.success(`Broker "${name.trim()}" created`)
      } else if (field.searchTable === 'affiliates') {
        const { data, error } = await supabase.from('affiliates').insert({
          name: name.trim(), email: `${name.trim().toLowerCase().replace(/\s+/g, '.')}@pending.com`,
          status: 'LEAD', deal_type: 'CPA'
        }).select('id').single()
        if (error) throw error
        newId = data.id
        toast.success(`Affiliate "${name.trim()}" created — update email in their profile`)
      }
      if (newId) advanceStep(newId)
    } catch (err) {
      toast.error(`Failed to create: ${err.message}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  const submitForm = async (data) => {
    setIsSubmitting(true)
    try {
      const config = ENTITY_CONFIGS[entityType]
      const insertData = { ...data }

      if (entityType === 'affiliate') {
        const brokerId = insertData.broker_id
        delete insertData.broker_id  // now in affiliate_brokers junction table
        if (!insertData.manager_id) delete insertData.manager_id
        if (!insertData.master_ib_id) delete insertData.master_ib_id
        if (!insertData.deal_type) insertData.deal_type = null

        const { data: newAff, error: affErr } = await supabase.from(config.table).insert(insertData).select('id').single()
        if (affErr) throw affErr
        if (brokerId) {
          await supabase.from('affiliate_brokers').insert({ affiliate_id: newAff.id, broker_id: brokerId })
        }
        toast.success('Affiliate created successfully!')
        setOpen(false); reset(); router.refresh()
        return
      }
      if (entityType === 'revenue') {
        insertData.month = parseInt(insertData.month)
        insertData.year = parseInt(insertData.year)
        insertData.revenue_amount = parseFloat(insertData.revenue_amount)
        insertData.staff_member_id = userId
        insertData.status = 'PENDING'
        if (!insertData.broker_id) delete insertData.broker_id
      }
      if (entityType === 'appointment') {
        insertData.scheduled_at = new Date(insertData.scheduled_at).toISOString()
        insertData.user_id = userId
      }
      if (entityType === 'note') {
        insertData.user_id = userId
      }

      const { error } = await supabase.from(config.table).insert(insertData)
      if (error) throw error

      toast.success(`${config.label} created successfully!`)
      setOpen(false)
      reset()
      router.refresh()
    } catch (err) {
      toast.error(`Failed to create: ${err.message}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') { setOpen(false); return }

    if (mode === 'add') {
      const config = ENTITY_CONFIGS[entityType]
      const field = config?.fields[currentStep]

      if (field?.type === 'search' && suggestions.length > 0) {
        if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedSuggestion(prev => Math.min(prev + 1, suggestions.length - 1)); return }
        if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedSuggestion(prev => Math.max(prev - 1, 0)); return }
        if (e.key === 'Enter' || e.key === 'Tab') {
          e.preventDefault()
          const selected = suggestions[selectedSuggestion]
          if (selected) advanceStep(selected.id)
          return
        }
      } else if (field?.type === 'select') {
        if (e.key === 'ArrowDown') { e.preventDefault(); const opts = field.options; const idx = opts.indexOf(input); setInput(opts[Math.min(idx + 1, opts.length - 1)] || opts[0]); return }
        if (e.key === 'ArrowUp') { e.preventDefault(); const opts = field.options; const idx = opts.indexOf(input); setInput(opts[Math.max(idx - 1, 0)] || opts[0]); return }
        if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); if (!field.required && !input) { advanceStep(''); } else { advanceStep(input || field.options[0]); } return }
      } else {
        if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); advanceStep(); return }
      }

      if (e.key === 'Backspace' && !input) { e.preventDefault(); goBack() }
    }

    if (mode === 'search' && e.key === 'Enter' && searchResults.length > 0) {
      e.preventDefault()
      router.push(searchResults[0].href)
      setOpen(false)
    }
  }

  const currentConfig = entityType ? ENTITY_CONFIGS[entityType] : null
  const currentField = currentConfig?.fields[currentStep]

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-[560px] p-0 gap-0 overflow-hidden [&>button]:hidden">
        <div className="p-4">
          {mode === 'add' && currentConfig && (
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <currentConfig.icon className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium">New {currentConfig.label}</span>
              </div>
              <Badge variant="secondary" className="text-xs">
                Step {currentStep + 1} of {currentConfig.fields.length}
              </Badge>
            </div>
          )}

          {mode === 'add' && currentStep > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {currentConfig.fields.slice(0, currentStep).map((f, i) => (
                <Badge key={i} variant="secondary" className="text-xs gap-1">
                  <Check className="w-3 h-3" />
                  {f.label}: {String(formData[f.key] || '').substring(0, 20)}
                </Badge>
              ))}
            </div>
          )}

          <div className="flex items-center gap-2 border border-border rounded-lg px-3 py-2 bg-muted/30 focus-within:ring-2 focus-within:ring-primary/50">
            {mode === 'search' && <Search className="w-4 h-4 text-muted-foreground shrink-0" />}
            {mode === 'entity-select' && <Plus className="w-4 h-4 text-primary shrink-0" />}
            {mode === 'add' && <ArrowRight className="w-4 h-4 text-primary shrink-0" />}
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => handleInputChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                mode === 'search' ? 'Search affiliates, brokers, staff... or type @ to add'
                : mode === 'entity-select' ? 'Select: @broker @affiliate @revenue @appointment'
                : currentField ? `${currentField.label}${currentField.required ? ' *' : ''}...`
                : ''
              }
              className="flex-1 bg-transparent border-none outline-none text-sm placeholder:text-muted-foreground"
              disabled={isSubmitting}
            />
            {isSubmitting && <Loader2 className="w-4 h-4 animate-spin text-primary" />}
          </div>
        </div>

        <div className="max-h-64 overflow-y-auto border-t border-border">
          {/* Entity select */}
          {mode === 'entity-select' && (
            <div className="p-2">
              {Object.entries(ENTITY_CONFIGS).map(([key, config]) => (
                <button key={key} onClick={() => selectEntity(key)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm hover:bg-muted/50 transition-colors text-left">
                  <config.icon className="w-4 h-4 text-primary" />
                  <span className="font-medium">@{key}</span>
                  <span className="text-muted-foreground ml-auto text-xs">Add new {config.label.toLowerCase()}</span>
                </button>
              ))}
            </div>
          )}

          {/* Search results */}
          {mode === 'search' && searchResults.length > 0 && (
            <div className="p-2">
              {searchResults.map((result) => (
                <button key={`${result.type}-${result.id}`}
                  onClick={() => { router.push(result.href); setOpen(false) }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm hover:bg-muted/50 transition-colors text-left">
                  {result.type === 'affiliate' && <Users className="w-4 h-4 text-primary" />}
                  {result.type === 'broker' && <Building2 className="w-4 h-4 text-green-500" />}
                  {result.type === 'staff' && <Shield className="w-4 h-4 text-purple-500" />}
                  <div>
                    <p className="font-medium">{result.name}</p>
                    {result.email && <p className="text-xs text-muted-foreground">{result.email}</p>}
                  </div>
                  <Badge variant="outline" className="ml-auto text-xs capitalize">{result.type}</Badge>
                </button>
              ))}
            </div>
          )}

          {/* Suggestions for search fields */}
          {mode === 'add' && currentField?.type === 'search' && (suggestions.length > 0 || input) && (
            <div className="p-2">
              {suggestions.map((s, i) => (
                <button key={s.id} onClick={() => advanceStep(s.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm hover:bg-muted/50 transition-colors text-left ${i === selectedSuggestion ? 'bg-muted/50' : ''}`}>
                  {s.label}
                </button>
              ))}
              {suggestions.length === 0 && input && (
                <p className="px-3 py-1.5 text-xs text-muted-foreground">No results for &ldquo;{input}&rdquo;</p>
              )}
              {input && (currentField.searchTable === 'brokers' || currentField.searchTable === 'affiliates') && (
                <button onClick={() => createAndAdvance(currentField, input)}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm hover:bg-primary/10 text-primary transition-colors text-left border-t border-border mt-1 pt-2">
                  <Plus className="w-3.5 h-3.5 shrink-0" />
                  Create &ldquo;{input}&rdquo; as new {currentField.searchTable === 'brokers' ? 'broker' : 'affiliate'}
                </button>
              )}
              {!currentField.required && (
                <button onClick={() => advanceStep('')}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm hover:bg-muted/50 text-muted-foreground transition-colors text-left border-t border-border mt-1 pt-2">
                  Skip →
                </button>
              )}
            </div>
          )}

          {/* Select options */}
          {mode === 'add' && currentField?.type === 'select' && (
            <div className="p-2">
              {currentField.options.map((opt) => (
                <button key={opt} onClick={() => advanceStep(opt)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm hover:bg-muted/50 transition-colors text-left ${input === opt ? 'bg-muted/50' : ''}`}>
                  {opt}
                </button>
              ))}
              {!currentField.required && (
                <button onClick={() => advanceStep('')}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm hover:bg-muted/50 text-muted-foreground transition-colors text-left border-t border-border mt-1 pt-2">
                  Skip &rarr;
                </button>
              )}
            </div>
          )}

          {/* Empty search state */}
          {mode === 'search' && input && searchResults.length === 0 && !input.startsWith('@') && (
            <div className="p-6 text-center text-sm text-muted-foreground">
              No results found. Type <kbd className="px-1.5 py-0.5 rounded bg-muted text-xs">@</kbd> to add new entries.
            </div>
          )}
        </div>

        <div className="px-4 py-2 border-t flex items-center gap-4 text-xs text-muted-foreground bg-muted/20">
          <span><kbd className="px-1 py-0.5 rounded bg-muted">Enter</kbd> {mode === 'add' ? 'Next' : 'Select'}</span>
          <span><kbd className="px-1 py-0.5 rounded bg-muted">Tab</kbd> Next</span>
          {mode === 'add' && <span><kbd className="px-1 py-0.5 rounded bg-muted">Backspace</kbd> Back</span>}
          <span><kbd className="px-1 py-0.5 rounded bg-muted">Esc</kbd> Close</span>
        </div>
      </DialogContent>
    </Dialog>
  )
}
