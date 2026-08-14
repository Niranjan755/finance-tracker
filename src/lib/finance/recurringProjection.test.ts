import { describe, expect, it } from 'vitest'
import type { RecurringTransaction } from '@/types'
import { projectAllOccurrences, projectOccurrences } from './recurringProjection'

function makeRecurring(overrides: Partial<RecurringTransaction> = {}): RecurringTransaction {
  return {
    id: 'rec_rent',
    name: 'Rent',
    accountId: 'checking',
    categoryId: 'cat_exp_housing_rent',
    type: 'expense',
    amountCents: 200000,
    frequency: 'monthly',
    startDate: '2026-01-01',
    endDate: null,
    nextRunDate: '2026-08-31',
    isActive: true,
    createdAt: '',
    updatedAt: '',
    ...overrides,
  }
}

describe('projectOccurrences', () => {
  it('returns the next occurrence within the horizon', () => {
    const result = projectOccurrences(makeRecurring(), '2026-08-14', 30)
    expect(result).toHaveLength(1)
    expect(result[0]?.date).toBe('2026-08-31')
  })

  it('returns multiple occurrences for a short-frequency item across a long horizon, including an overdue one', () => {
    const netflix = makeRecurring({
      id: 'rec_netflix',
      name: 'Netflix',
      amountCents: 2299,
      frequency: 'monthly',
      nextRunDate: '2026-08-02',
    })
    const result = projectOccurrences(netflix, '2026-08-14', 90)
    expect(result.map((o) => o.date)).toEqual([
      '2026-08-02',
      '2026-09-02',
      '2026-10-02',
      '2026-11-02',
    ])
  })

  it('returns nothing for an inactive recurring item', () => {
    const result = projectOccurrences(makeRecurring({ isActive: false }), '2026-08-14', 30)
    expect(result).toHaveLength(0)
  })

  it('stops at the end date', () => {
    const result = projectOccurrences(
      makeRecurring({ nextRunDate: '2026-08-31', endDate: '2026-08-31' }),
      '2026-08-14',
      90,
    )
    expect(result).toHaveLength(1)
  })

  it('returns nothing outside the horizon', () => {
    const result = projectOccurrences(makeRecurring({ nextRunDate: '2027-01-01' }), '2026-08-14', 30)
    expect(result).toHaveLength(0)
  })
})

describe('projectAllOccurrences', () => {
  it('merges and sorts occurrences from multiple recurring items by date', () => {
    const rent = makeRecurring({ id: 'rec_rent', nextRunDate: '2026-08-31' })
    const netflix = makeRecurring({
      id: 'rec_netflix',
      name: 'Netflix',
      amountCents: 2299,
      nextRunDate: '2026-08-20',
    })
    const result = projectAllOccurrences([rent, netflix], '2026-08-14', 30)
    expect(result.map((o) => o.name)).toEqual(['Netflix', 'Rent'])
  })
})
