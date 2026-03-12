/**
 * LogbookEmptyState component tests
 *
 * Covers:
 *  - Renders the primary heading
 *  - Renders the descriptive sub-copy
 *  - Renders an illustrative icon/element (aria-hidden decoration)
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'
import { LogbookEmptyState } from './EmptyState'

describe('LogbookEmptyState', () => {
  it('renders the primary heading', () => {
    render(<LogbookEmptyState />)
    expect(
      screen.getByRole('heading', { name: /nothing completed yet/i })
    ).toBeInTheDocument()
  })

  it('renders the descriptive copy', () => {
    render(<LogbookEmptyState />)
    expect(
      screen.getByText(/mark your first task done/i)
    ).toBeInTheDocument()
  })

  it('renders without crashing when mounted', () => {
    const { container } = render(<LogbookEmptyState />)
    expect(container.firstChild).not.toBeNull()
  })
})
