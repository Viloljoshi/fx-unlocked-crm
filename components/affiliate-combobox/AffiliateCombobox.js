'use client'

import { useState, useEffect, useRef } from 'react'
import { X, ChevronDown, Search } from 'lucide-react'

export default function AffiliateCombobox({ affiliates = [], value, onChange, excludeId, placeholder }) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const ref = useRef(null)

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Filter: exclude self, sort A-Z, then filter by search
  const sorted = [...affiliates]
    .filter(a => a.id !== excludeId)
    .sort((a, b) => (a.name || '').localeCompare(b.name || ''))

  const filtered = sorted.filter(a =>
    !search || a.name?.toLowerCase().includes(search.toLowerCase())
  )

  const selectedAffiliate = affiliates.find(a => a.id === value)
  const displayLabel = selectedAffiliate?.name || ''

  const handleSelect = (aff) => {
    onChange(aff.id)
    setSearch('')
    setOpen(false)
  }

  const handleClear = (e) => {
    e.stopPropagation()
    onChange('none')
    setSearch('')
  }

  return (
    <div className="relative" ref={ref}>
      <div
        className="flex items-center border rounded-md px-3 py-2 text-sm cursor-text bg-background min-h-[36px] gap-2"
        onClick={() => { setOpen(true); setTimeout(() => ref.current?.querySelector('input')?.focus(), 50) }}
      >
        {displayLabel ? (
          <>
            <span className="flex-1 truncate">{displayLabel}</span>
            <button type="button" onClick={handleClear} className="text-muted-foreground hover:text-foreground">
              <X className="w-3.5 h-3.5" />
            </button>
          </>
        ) : (
          <>
            <input
              className="flex-1 bg-transparent outline-none placeholder:text-muted-foreground text-sm"
              placeholder={placeholder || 'Search Master IB...'}
              value={open ? search : ''}
              onChange={e => { setSearch(e.target.value); setOpen(true) }}
              onFocus={() => setOpen(true)}
            />
            <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          </>
        )}
      </div>

      {open && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-card border rounded-md shadow-lg max-h-48 overflow-y-auto">
          {displayLabel && (
            <div className="p-2 border-b">
              <div className="flex items-center gap-2">
                <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <input
                  autoFocus
                  className="w-full text-sm outline-none bg-transparent placeholder:text-muted-foreground"
                  placeholder="Search affiliates..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
            </div>
          )}
          {filtered.length === 0 && (
            <div className="px-3 py-2 text-xs text-muted-foreground">
              {search ? `No affiliates matching "${search}"` : 'No affiliates available'}
            </div>
          )}
          {filtered.map(a => (
            <button key={a.id} type="button"
              className="w-full text-left px-3 py-2 text-sm hover:bg-muted/50 transition-colors"
              onClick={() => handleSelect(a)}>
              {a.name}
              {a.status && <span className="text-xs text-muted-foreground ml-1.5">({a.status})</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
