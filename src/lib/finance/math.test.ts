import { describe, expect, it } from 'vitest'
import { toCents } from '@/lib/money'
import { availableCredit, creditUtilization } from './math'

describe('credit card math', () => {
  it('matches the spec example: $5,000 limit, $1,200 balance', () => {
    const limit = toCents('5000')
    const balance = toCents('1200')
    expect(availableCredit(limit, balance)).toBe(toCents('3800'))
    expect(creditUtilization(limit, balance)).toBeCloseTo(24, 5)
  })

  it('matches the spec example: $5,000 limit, $1,000 balance, $500 purchase', () => {
    const limit = toCents('5000')
    const balanceAfterPurchase = toCents('1000') + toCents('500')
    expect(balanceAfterPurchase).toBe(toCents('1500'))
    expect(availableCredit(limit, balanceAfterPurchase)).toBe(toCents('3500'))
  })

  it('never reports negative available credit when over limit', () => {
    expect(availableCredit(toCents('1000'), toCents('1500'))).toBe(0)
  })

  it('returns 0 utilization for a zero limit instead of dividing by zero', () => {
    expect(creditUtilization(0, toCents('100'))).toBe(0)
  })
})
