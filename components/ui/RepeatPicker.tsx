'use client'

import type { RecurrenceRule } from '@/lib/types'

const OPTIONS: { value: '' | RecurrenceRule; label: string }[] = [
  { value: '', label: 'None' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly', label: 'Yearly' },
]

interface RepeatPickerProps {
  value: RecurrenceRule | null
  onChange: (value: RecurrenceRule | null) => void
  disabled?: boolean
}

/** Recurrence preset select used in the processing flow (spec: recurrence v1). */
export function RepeatPicker({ value, onChange, disabled }: RepeatPickerProps) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor="repeat-picker" className="text-xs" style={{ color: 'var(--text-muted)' }}>
        Repeat
      </label>
      <select
        id="repeat-picker"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value === '' ? null : (e.target.value as RecurrenceRule))}
        className="glass-input text-sm"
        disabled={disabled}
      >
        {OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  )
}
