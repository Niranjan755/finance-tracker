import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MoneyText } from './MoneyText'

describe('MoneyText', () => {
  it('shows a minus sign for a negative amount even when signed=false', () => {
    render(<MoneyText cents={-142500} kind="neutral" signed={false} />)
    expect(screen.getByText('-$1,425.00')).toBeInTheDocument()
  })

  it('shows no leading sign for a positive amount when signed=false', () => {
    render(<MoneyText cents={142500} kind="neutral" signed={false} />)
    expect(screen.getByText('$1,425.00')).toBeInTheDocument()
  })

  it('auto-switches to expense styling for a negative neutral amount', () => {
    render(<MoneyText cents={-100} kind="neutral" signed={false} />)
    expect(screen.getByText('-$1.00')).toHaveClass('text-red-600')
  })

  it('still shows explicit +/- when signed=true', () => {
    render(<MoneyText cents={8540} kind="expense" />)
    expect(screen.getByText('-$85.40')).toBeInTheDocument()
    render(<MoneyText cents={420000} kind="income" />)
    expect(screen.getByText('+$4,200.00')).toBeInTheDocument()
  })
})
