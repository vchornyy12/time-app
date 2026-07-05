import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { RepeatPicker } from './RepeatPicker'

describe('RepeatPicker', () => {
  it('renders a select labeled "Repeat" with None + 4 presets', () => {
    render(<RepeatPicker value={null} onChange={() => {}} />)
    const select = screen.getByLabelText('Repeat')
    const options = [...select.querySelectorAll('option')].map((o) => o.textContent)
    expect(options).toEqual(['None', 'Daily', 'Weekly', 'Monthly', 'Yearly'])
  })

  it('shows None selected when value is null', () => {
    render(<RepeatPicker value={null} onChange={() => {}} />)
    expect(screen.getByLabelText('Repeat')).toHaveValue('')
  })

  it('reflects a non-null value', () => {
    render(<RepeatPicker value="monthly" onChange={() => {}} />)
    expect(screen.getByLabelText('Repeat')).toHaveValue('monthly')
  })

  it('calls onChange with the rule when a preset is chosen', () => {
    const onChange = vi.fn()
    render(<RepeatPicker value={null} onChange={onChange} />)
    fireEvent.change(screen.getByLabelText('Repeat'), { target: { value: 'weekly' } })
    expect(onChange).toHaveBeenCalledWith('weekly')
  })

  it('calls onChange with null when None is chosen', () => {
    const onChange = vi.fn()
    render(<RepeatPicker value="daily" onChange={onChange} />)
    fireEvent.change(screen.getByLabelText('Repeat'), { target: { value: '' } })
    expect(onChange).toHaveBeenCalledWith(null)
  })

  it('disables the select when disabled', () => {
    render(<RepeatPicker value={null} onChange={() => {}} disabled />)
    expect(screen.getByLabelText('Repeat')).toBeDisabled()
  })
})
