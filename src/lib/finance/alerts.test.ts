import { describe, expect, it } from 'vitest'
import { toCents } from '@/lib/money'
import type { Budget, Category, RecurringTransaction, Transaction } from '@/types'
import { computeBudgetAlerts, computeUpcomingPaymentAlerts } from './alerts'

function txn(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: `txn_${Math.random()}`,
    accountId: 'acct',
    categoryId: 'food',
    type: 'expense',
    amountCents: 0,
    merchant: '',
    description: '',
    date: '2026-08-01',
    notes: '',
    tags: [],
    location: '',
    receiptId: null,
    recurringId: null,
    plaidTransactionId: null,
    possibleDuplicateOfId: null,
    createdAt: '',
    updatedAt: '',
    ...overrides,
  }
}

function budget(overrides: Partial<Budget> = {}): Budget {
  return {
    id: `b_${Math.random()}`,
    categoryId: 'food',
    month: 8,
    year: 2026,
    amountCents: toCents('600'),
    rolloverEnabled: false,
    ...overrides,
  }
}

const foodCategory: Category = {
  id: 'food',
  name: 'Food',
  type: 'expense',
  parentId: null,
  icon: '',
  color: '',
  isDefault: true,
}

function recurring(overrides: Partial<RecurringTransaction> = {}): RecurringTransaction {
  return {
    id: `rec_${Math.random()}`,
    name: 'Rent',
    accountId: 'acct',
    categoryId: 'food',
    type: 'expense',
    amountCents: toCents('1000'),
    frequency: 'monthly',
    startDate: '2026-01-01',
    endDate: null,
    nextRunDate: '2026-08-05',
    isActive: true,
    createdAt: '',
    updatedAt: '',
    ...overrides,
  }
}

describe('computeBudgetAlerts', () => {
  it('flags budgets that are near or over their limit', () => {
    const budgets = [
      budget({ id: 'over', amountCents: toCents('100') }),
      budget({ id: 'ok', categoryId: 'other', amountCents: toCents('1000') }),
    ]
    const transactions = [
      txn({ categoryId: 'food', amountCents: toCents('150'), date: '2026-08-10' }),
      txn({ categoryId: 'other', amountCents: toCents('50'), date: '2026-08-10' }),
    ]
    const categories = [foodCategory, { ...foodCategory, id: 'other', name: 'Other' }]
    const alerts = computeBudgetAlerts(budgets, transactions, categories, [], 'USD', '2026-08-15')
    expect(alerts).toHaveLength(1)
    expect(alerts[0]?.budget.id).toBe('over')
    expect(alerts[0]?.progress.status).toBe('over-budget')
  })

  it('excludes budgets that are still within normal range', () => {
    const budgets = [budget({ amountCents: toCents('600') })]
    const transactions = [txn({ amountCents: toCents('100'), date: '2026-08-10' })]
    const alerts = computeBudgetAlerts(budgets, transactions, [foodCategory], [], 'USD', '2026-08-15')
    expect(alerts).toHaveLength(0)
  })
})

describe('computeUpcomingPaymentAlerts', () => {
  it('includes active rules due within the horizon', () => {
    const rules = [recurring({ id: 'due-soon', nextRunDate: '2026-08-18' })]
    const alerts = computeUpcomingPaymentAlerts(rules, '2026-08-15', 7)
    expect(alerts).toHaveLength(1)
    expect(alerts[0]?.daysUntil).toBe(3)
  })

  it('excludes rules due outside the horizon', () => {
    const rules = [recurring({ id: 'far-off', nextRunDate: '2026-09-15' })]
    const alerts = computeUpcomingPaymentAlerts(rules, '2026-08-15', 7)
    expect(alerts).toHaveLength(0)
  })

  it('excludes inactive rules', () => {
    const rules = [recurring({ nextRunDate: '2026-08-16', isActive: false })]
    const alerts = computeUpcomingPaymentAlerts(rules, '2026-08-15', 7)
    expect(alerts).toHaveLength(0)
  })

  it('dedupes to a single (soonest) entry per rule', () => {
    // Weekly rule with several occurrences inside the horizon - only the
    // nearest should surface as an alert, not one per occurrence.
    const rules = [
      recurring({ id: 'weekly', frequency: 'weekly', nextRunDate: '2026-08-16', startDate: '2026-08-16' }),
    ]
    const alerts = computeUpcomingPaymentAlerts(rules, '2026-08-15', 14)
    expect(alerts).toHaveLength(1)
    expect(alerts[0]?.dueDate).toBe('2026-08-16')
  })
})
