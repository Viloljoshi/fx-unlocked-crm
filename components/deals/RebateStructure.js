'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Plus, Trash2, AlertTriangle, ChevronDown, ChevronRight } from 'lucide-react'

const REBATE_FIELDS = [
  { key: 'rebate_forex', label: 'Forex' },
  { key: 'rebate_gold', label: 'Gold' },
  { key: 'rebate_crypto', label: 'Crypto' },
  { key: 'rebate_custom', label: 'Custom' },
]

const DEFAULT_LEVEL = {
  level_number: 0,
  label: '',
  affiliate_id: null,
  rebate_forex: 0,
  rebate_gold: 0,
  rebate_crypto: 0,
  rebate_custom: 0,
}

export default function RebateStructure({ levels = [], onChange, affiliates = [], readOnly = false }) {
  const [localLevels, setLocalLevels] = useState([])
  const [errors, setErrors] = useState([])
  const [expandedLevels, setExpandedLevels] = useState({})

  // Initialize with default Level 0 if empty
  useEffect(() => {
    if (levels.length > 0) {
      setLocalLevels(levels.map((l) => ({ ...DEFAULT_LEVEL, ...l })))
      // Expand all by default
      const expanded = {}
      levels.forEach((l) => { expanded[l.level_number] = true })
      setExpandedLevels(expanded)
    } else {
      setLocalLevels([
        { ...DEFAULT_LEVEL, level_number: 0, label: 'FX Unlocked' },
        { ...DEFAULT_LEVEL, level_number: 1, label: 'Master IB' },
      ])
      setExpandedLevels({ 0: true, 1: true })
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const validate = useCallback((lvls) => {
    const errs = []
    const level0 = lvls.find((l) => l.level_number === 0)
    if (!level0) return errs

    REBATE_FIELDS.forEach(({ key, label }) => {
      const baseValue = parseFloat(level0[key]) || 0
      const childSum = lvls
        .filter((l) => l.level_number > 0)
        .reduce((sum, l) => sum + (parseFloat(l[key]) || 0), 0)

      if (childSum > baseValue) {
        errs.push(
          `${label}: child levels total (${childSum.toFixed(4)}) exceeds Level 0 base (${baseValue.toFixed(4)})`
        )
      }
    })

    return errs
  }, [])

  const updateLevels = useCallback((newLevels) => {
    setLocalLevels(newLevels)
    const errs = validate(newLevels)
    setErrors(errs)
    if (onChange) onChange(newLevels, errs)
  }, [onChange, validate])

  const handleFieldChange = (levelNumber, field, value) => {
    const updated = localLevels.map((l) =>
      l.level_number === levelNumber
        ? { ...l, [field]: field.startsWith('rebate_') ? parseFloat(value) || 0 : value }
        : l
    )
    updateLevels(updated)
  }

  const addLevel = () => {
    const maxLevel = Math.max(...localLevels.map((l) => l.level_number), 0)
    const newLevel = {
      ...DEFAULT_LEVEL,
      level_number: maxLevel + 1,
      label: `Sub-IB Level ${maxLevel + 1}`,
    }
    const updated = [...localLevels, newLevel]
    setExpandedLevels((prev) => ({ ...prev, [newLevel.level_number]: true }))
    updateLevels(updated)
  }

  const removeLevel = (levelNumber) => {
    if (levelNumber <= 1) return // Can't remove Level 0 or 1
    const updated = localLevels.filter((l) => l.level_number !== levelNumber)
    updateLevels(updated)
  }

  const toggleExpand = (levelNumber) => {
    setExpandedLevels((prev) => ({ ...prev, [levelNumber]: !prev[levelNumber] }))
  }

  const level0 = localLevels.find((l) => l.level_number === 0)

  // Calculate remaining allocations
  const remaining = {}
  if (level0) {
    REBATE_FIELDS.forEach(({ key }) => {
      const base = parseFloat(level0[key]) || 0
      const used = localLevels
        .filter((l) => l.level_number > 0)
        .reduce((sum, l) => sum + (parseFloat(l[key]) || 0), 0)
      remaining[key] = base - used
    })
  }

  return (
    <div className="space-y-4">
      {/* Validation errors */}
      {errors.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <ul className="list-disc pl-4 space-y-1">
              {errors.map((err, i) => (
                <li key={i} className="text-sm">{err}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* Remaining allocation summary */}
      {level0 && localLevels.length > 1 && (
        <div className="grid grid-cols-4 gap-2 p-3 bg-muted/50 rounded-lg">
          {REBATE_FIELDS.map(({ key, label }) => (
            <div key={key} className="text-center">
              <p className="text-xs text-muted-foreground">{label} Remaining</p>
              <p className={`text-sm font-semibold ${remaining[key] < 0 ? 'text-destructive' : 'text-green-600'}`}>
                {(remaining[key] || 0).toFixed(4)}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Levels */}
      <div className="space-y-3">
        {localLevels
          .sort((a, b) => a.level_number - b.level_number)
          .map((level) => {
            const isExpanded = expandedLevels[level.level_number] !== false
            const isBase = level.level_number === 0
            const isMasterIB = level.level_number === 1

            return (
              <Card key={level.level_number} className={isBase ? 'border-primary/30 bg-primary/5' : ''}>
                <CardHeader className="py-3 px-4 cursor-pointer" onClick={() => toggleExpand(level.level_number)}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      <CardTitle className="text-sm font-medium">
                        Level {level.level_number}: {level.label || `Level ${level.level_number}`}
                      </CardTitle>
                      {isBase && (
                        <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded font-medium">Base</span>
                      )}
                    </div>
                    {!readOnly && !isBase && !isMasterIB && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={(e) => { e.stopPropagation(); removeLevel(level.level_number) }}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                </CardHeader>

                {isExpanded && (
                  <CardContent className="pt-0 px-4 pb-4 space-y-3">
                    {/* Label */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs">Label</Label>
                        <Input
                          value={level.label}
                          onChange={(e) => handleFieldChange(level.level_number, 'label', e.target.value)}
                          placeholder="Level name"
                          disabled={readOnly || isBase}
                          className="h-8 text-sm"
                        />
                      </div>
                      {/* Affiliate selector for non-base levels */}
                      {!isBase && (
                        <div>
                          <Label className="text-xs">Assign IB / Affiliate</Label>
                          <Select
                            value={level.affiliate_id || ''}
                            onValueChange={(val) => handleFieldChange(level.level_number, 'affiliate_id', val || null)}
                            disabled={readOnly}
                          >
                            <SelectTrigger className="h-8 text-sm">
                              <SelectValue placeholder="Select affiliate..." />
                            </SelectTrigger>
                            <SelectContent>
                              {affiliates.map((a) => (
                                <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </div>

                    {/* Rebate fields */}
                    <div className="grid grid-cols-4 gap-3">
                      {REBATE_FIELDS.map(({ key, label }) => (
                        <div key={key}>
                          <Label className="text-xs">{label}</Label>
                          <Input
                            type="number"
                            step="0.0001"
                            min="0"
                            value={level[key]}
                            onChange={(e) => handleFieldChange(level.level_number, key, e.target.value)}
                            disabled={readOnly}
                            className="h-8 text-sm"
                          />
                        </div>
                      ))}
                    </div>
                  </CardContent>
                )}
              </Card>
            )
          })}
      </div>

      {/* Add level button */}
      {!readOnly && (
        <Button variant="outline" size="sm" onClick={addLevel} className="w-full">
          <Plus className="w-4 h-4 mr-1.5" />
          Add Sub-Level
        </Button>
      )}
    </div>
  )
}
