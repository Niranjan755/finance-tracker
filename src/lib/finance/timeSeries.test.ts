import { describe, expect, it } from 'vitest'
import { toCents } from '@/lib/money'
import type { Account, Transaction } from '@/types'
import {
  computeAccountBalanceTrend,
  computeIncomeVsExpenseSeries,
  computeNetWorthTrend,
  computeSpendingTrend,
  rangeFromPreset,
} from './timeSeries'

function account(overrides: Partial<Account> = {}): Account {
  return {
    id: 'acct',
    name: 'Account',
    institution: '',
    type: 'checking',
    lastFour: '',
    balanceCents: 0,
    creditLimitCents: null,
    statementBalanceCents: null,
    minimumPaymentCents: null,
    paymentDueDate: null,
    currency: 'USD',
    icon: '',
    color: '',
    isActive: true,
    notes: '',
    createdAt: '',
    updatedAt: '',
    ...overrides,
  }
}

function txn(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: `txn_${Math.random()}`,
    accountId: 'acct',
    categoryId: 'cat',
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
    createdAt: '',
    updatedAt: '',
    ...overrides,
  }
}

describe('rangeFromPreset', () => {
  it('computes a 7 day window ending today, inclusive', () => {
    const range = rangeFromPreset('7d', new Date(2026, 7, 14))
    expect(range).toEqual({ startISO: '2026-08-08', endISO: '2026-08-14' })
  })
})

describe('computeIncomeVsExpenseSeries', () => {
  it('buckets transactions by month across the requested window', () => {
    const transactions: Transaction[] = [
      txn({ type: 'income', amountCents: toCents('7500'), date: '2026-06-05' }),
      txn({ type: 'expense', amountCents: toCents('4200'), date: '2026-06-10' }),
      txn({ type: 'income', amountCents: toCents('8000'), date: '2026-07-05' }),
      txn({ type: 'expense', amountCents: toCents('4700'), date: '2026-07-10' }),
      txn({ type: 'income', amountCents: toCents('8200'), date: '2026-08-05' }),
      txn({ type: 'expense', amountCents: toCents('4100'), date: '2026-08-10' }),
    ]
    const series = computeIncomeVsExpenseSeries(transactions, '2026-08-14', 3)
    expect(series.map((p) => p.label)).toEqual(['Jun', 'Jul', 'Aug'])
    expect(series[0]).toMatchObject({ incomeCents: toCents('7500'), expenseCents: toCents('4200') })
    expect(series[2]).toMatchObject({ incomeCents: toCents('8200'), expenseCents: toCents('4100') })
  })

  it('excludes months outside the window', () => {
    const transactions: Transaction[] = [
      txn({ type: 'expense', amountCents: 100, date: '2026-01-01' }),
    ]
    const series = computeIncomeVsExpenseSeries(transactions, '2026-08-14', 3)
    expect(series.reduce((s, p) => s + p.expenseCents, 0)).toBe(0)
  })
})

describe('computeSpendingTrend', () => {
  it('produces one point per day with correct totals', () => {
    const transactions: Transaction[] = [
      txn({ type: 'expense', amountCents: toCents('50'), date: '2026-08-01' }),
      txn({ type: 'expense', amountCents: toCents('25'), date: '2026-08-01' }),
      txn({ type: 'income', amountCents: toCents('1000'), date: '2026-08-01' }),
      txn({ type: 'expense', amountCents: toCents('10'), date: '2026-08-03' }),
    ]
    const points = computeSpendingTrend(transactions, {
      startISO: '2026-08-01',
      endISO: '2026-08-03',
    })
    expect(points).toHaveLength(3)
    expect(points[0]?.expenseCents).toBe(toCents('75'))
    expect(points[1]?.expenseCents).toBe(0)
    expect(points[2]?.expenseCents).toBe(toCents('10'))
  })
})

describe('computeNetWorthTrend', () => {
  it('reflects income/expense deltas per month, ending at the current net worth', () => {
    const accounts = [account({ balanceCents: toCents('13320') })]
    const transactions: Transaction[] = [
      txn({ type: 'income', amountCents: toCents('9050'), date: '2026-08-05' }),
      txn({ type: 'expense', amountCents: toCents('4180'), date: '2026-08-10' }),
    ]
    const trend = computeNetWorthTrend(accounts, transactions, '2026-08-14', 2)
    // August (current, partial) ends at the real net worth.
    expect(trend[1]?.netWorthCents).toBe(toCents('13320'))
    // July had none of August's income/expense, so it's 9050-4180=4870 less.
    expect(trend[0]?.netWorthCents).toBe(toCents('13320') - toCents('4870'))
  })
})

describe('computeAccountBalanceTrend', () => {
  it('rolls back a checking account balance to a prior month', () => {
    const accounts = [account({ id: 'checking', balanceCents: toCents('900') })]
    const transactions: Transaction[] = [
      txn({
        accountId: 'checking',
        type: 'expense',
        amountCents: toCents('100'),
        date: '2026-08-05',
      }),
    ]
    const trend = computeAccountBalanceTrend(accounts, transactions, '2026-08-14', 2)
    expect(trend[1]?.balances.checking).toBe(toCents('900'))
    expect(trend[0]?.balances.checking).toBe(toCents('1000'))
  })
})
