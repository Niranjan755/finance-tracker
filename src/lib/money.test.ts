import { describe, expect, it } from 'vitest'
import {
  addMoney,
  centsToInputValue,
  formatCurrency,
  formatSignedCurrency,
  fromCents,
  percentOf,
  subtractMoney,
  toCents,
} from './money'

describe('toCents', () => {
  it('parses whole dollar strings', () => {
    expect(toCents('10')).toBe(1000)
  })

  it('parses two-decimal strings exactly', () => {
    expect(toCents('10.25')).toBe(1025)
    expect(toCents('85.40')).toBe(8540)
    expect(toCents('0.01')).toBe(1)
  })

  it('rounds a third decimal digit', () => {
    expect(toCents('10.255')).toBe(1026)
    expect(toCents('10.254')).toBe(1025)
  })

  it('handles negative amounts', () => {
    expect(toCents('-45.20')).toBe(-4520)
  })

  it('strips thousands separators', () => {
    expect(toCents('1,234.56')).toBe(123456)
  })

  it('avoids classic float multiplication errors', () => {
    // 0.1 + 0.2 style traps: none of these should drift off by a cent.
    expect(toCents('0.1')).toBe(10)
    expect(toCents('0.29')).toBe(29)
    expect(toCents('1.005')).toBe(101) // rounds up from the third digit
  })

  it('parses number input without drifting', () => {
    expect(toCents(19.99)).toBe(1999)
    expect(toCents(100)).toBe(10000)
  })

  it('throws on invalid input', () => {
    expect(() => toCents('')).toThrow()
    expect(() => toCents('abc')).toThrow()
  })
})

describe('fromCents / centsToInputValue', () => {
  it('round-trips exactly', () => {
    expect(fromCents(toCents('30.30'))).toBe(30.3)
    expect(centsToInputValue(3030)).toBe('30.30')
  })
})

describe('addMoney / subtractMoney', () => {
  it('adds without floating point drift', () => {
    // $10.10 + $20.20 = $30.30, not 30.299999999999997
    const result = addMoney(toCents('10.10'), toCents('20.20'))
    expect(result).toBe(3030)
    expect(fromCents(result)).toBe(30.3)
  })

  it('sums an arbitrary number of values', () => {
    expect(addMoney(100, 200, 300)).toBe(600)
    expect(addMoney()).toBe(0)
  })

  it('subtracts exactly', () => {
    expect(subtractMoney(1000, 300)).toBe(700)
  })
})

describe('formatCurrency', () => {
  it('formats USD with two decimals', () => {
    expect(formatCurrency(425050, 'USD')).toBe('$4,250.50')
  })

  it('formats other currencies', () => {
    expect(formatCurrency(100000, 'EUR')).toContain('1.000,00')
    expect(formatCurrency(100000, 'INR')).toMatch(/₹1,000\.00/)
  })
})

describe('formatSignedCurrency', () => {
  it('prefixes expenses with a minus sign', () => {
    expect(formatSignedCurrency(8540, 'expense')).toBe('-$85.40')
  })

  it('prefixes income with a plus sign', () => {
    expect(formatSignedCurrency(420000, 'income')).toBe('+$4,200.00')
  })

  it('leaves transfers unsigned', () => {
    expect(formatSignedCurrency(100000, 'neutral')).toBe('$1,000.00')
  })
})

describe('percentOf', () => {
  it('computes a percentage rounded to one decimal', () => {
    expect(percentOf(toCents('425'), toCents('600'))).toBeCloseTo(70.8, 1)
  })

  it('returns 0 for a zero whole instead of dividing by zero', () => {
    expect(percentOf(100, 0)).toBe(0)
  })
})
