import { describe, expect, it } from 'vitest'
import { advanceByFrequency, getMonthBounds, isDateInRange, parseISODate, toISODate } from './date'

describe('getMonthBounds', () => {
  it('computes the first and last day of a month', () => {
    const bounds = getMonthBounds(2026, 8)
    expect(bounds.startISO).toBe('2026-08-01')
    expect(bounds.endISO).toBe('2026-08-31')
    expect(bounds.label).toBe('August 2026')
  })

  it('handles February correctly across leap years', () => {
    expect(getMonthBounds(2024, 2).endISO).toBe('2024-02-29')
    expect(getMonthBounds(2026, 2).endISO).toBe('2026-02-28')
  })
})

describe('isDateInRange', () => {
  it('includes boundary dates', () => {
    expect(isDateInRange('2026-08-01', '2026-08-01', '2026-08-31')).toBe(true)
    expect(isDateInRange('2026-08-31', '2026-08-01', '2026-08-31')).toBe(true)
  })

  it('excludes dates outside the range', () => {
    expect(isDateInRange('2026-09-01', '2026-08-01', '2026-08-31')).toBe(false)
  })
})

describe('advanceByFrequency', () => {
  const start = parseISODate('2026-01-31')

  it('advances monthly, clamping to the shorter month', () => {
    expect(toISODate(advanceByFrequency(start, 'monthly'))).toBe('2026-02-28')
  })

  it('advances biweekly by 14 days', () => {
    expect(toISODate(advanceByFrequency(parseISODate('2026-08-01'), 'biweekly'))).toBe('2026-08-15')
  })

  it('advances yearly', () => {
    expect(toISODate(advanceByFrequency(parseISODate('2026-08-14'), 'yearly'))).toBe('2027-08-14')
  })

  it('advances quarterly', () => {
    expect(toISODate(advanceByFrequency(parseISODate('2026-01-15'), 'quarterly'))).toBe(
      '2026-04-15',
    )
  })
})
