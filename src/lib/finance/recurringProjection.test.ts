import { describe, expect, it } from 'vitest'
import type { RecurringTransaction } from '@/types'
import {
  dueOccurrences,
  dueOccurrencesForAll,
  projectAllOccurrences,
  projectOccurrences,
} from './recurringProjection'

function makeRecurring(overrides: Partial<RecurringTransaction> = {}): RecurringTransaction {
  return {
    id: 'rec_rent',
    name: 'Rent',
    accountId: 'checking',
    categoryId: 'cat_exp_housing_rent',
    type: 'expense',
    amountCents: 200000,
    frequency: 'monthly',
    startDate: '2026-01-31',
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
      startDate: '2026-01-02',
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
    const result = projectOccurrences(
      makeRecurring({ nextRunDate: '2027-01-01' }),
      '2026-08-14',
      30,
    )
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
      startDate: '2026-01-20',
      nextRunDate: '2026-08-20',
    })
    const result = projectAllOccurrences([rent, netflix], '2026-08-14', 30)
    expect(result.map((o) => o.name)).toEqual(['Netflix', 'Rent'])
  })
})

describe('dueOccurrences', () => {
  it('returns only occurrences up to and including today', () => {
    const rule = makeRecurring({
      frequency: 'monthly',
      startDate: '2026-05-01',
      nextRunDate: '2026-05-01',
    })
    const result = dueOccurrences(rule, '2026-08-14')
    expect(result.map((o) => o.date)).toEqual([
      '2026-05-01',
      '2026-06-01',
      '2026-07-01',
      '2026-08-01',
    ])
  })

  it('returns a single entry when nothing is backlogged', () => {
    const rule = makeRecurring({ nextRunDate: '2026-08-10' })
    expect(dueOccurrences(rule, '2026-08-14')).toHaveLength(1)
  })

  it('returns nothing for an inactive item or when nothing is due yet', () => {
    expect(dueOccurrences(makeRecurring({ isActive: false }), '2026-08-14')).toHaveLength(0)
    expect(dueOccurrences(makeRecurring({ nextRunDate: '2027-01-01' }), '2026-08-14')).toHaveLength(0)
  })
})

describe('dueOccurrencesForAll', () => {
  it('only includes rules that have at least one due occurrence', () => {
    const overdue = makeRecurring({ id: 'rec_overdue', nextRunDate: '2026-08-01' })
    const notYetDue = makeRecurring({ id: 'rec_future', nextRunDate: '2027-01-01' })
    const result = dueOccurrencesForAll([overdue, notYetDue], '2026-08-14')
    expect(result.map((e) => e.recurring.id)).toEqual(['rec_overdue'])
  })

  it('flags a backlog via occurrences.length > 1, distinguishing it from a normal single due item', () => {
    const backlog = makeRecurring({
      id: 'rec_backlog',
      startDate: '2026-05-01',
      nextRunDate: '2026-05-01',
    })
    const onTime = makeRecurring({ id: 'rec_ontime', nextRunDate: '2026-08-10' })
    const result = dueOccurrencesForAll([backlog, onTime], '2026-08-14')
    const backlogEntry = result.find((e) => e.recurring.id === 'rec_backlog')
    const onTimeEntry = result.find((e) => e.recurring.id === 'rec_ontime')
    expect(backlogEntry?.occurrences.length).toBeGreaterThan(1)
    expect(onTimeEntry?.occurrences.length).toBe(1)
  })
})

describe('advanceByFrequency anchor-day fix (via projectOccurrences)', () => {
  it('returns to the 31st in a longer month instead of staying clamped after crossing February', () => {
    const rule = makeRecurring({
      frequency: 'monthly',
      startDate: '2026-01-31',
      nextRunDate: '2026-01-31',
    })
    // 4 months out covers Jan 31 -> Feb 28 -> Mar 31 -> Apr 30 -> May 31.
    const result = projectOccurrences(rule, '2026-01-01', 150)
    expect(result.map((o) => o.date)).toEqual([
      '2026-01-31',
      '2026-02-28',
      '2026-03-31',
      '2026-04-30',
      '2026-05-31',
    ])
  })
})
