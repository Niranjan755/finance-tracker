import { describe, expect, it } from 'vitest'
import { toCents } from '@/lib/money'
import type { Account, Category, Transaction } from '@/types'
import { computeInsights } from './insights'

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
    createdAt: '',
    updatedAt: '',
    ...overrides,
  }
}

const categories: Category[] = [
  {
    id: 'food',
    name: 'Food',
    type: 'expense',
    parentId: null,
    icon: '',
    color: '',
    isDefault: true,
  },
  {
    id: 'housing',
    name: 'Housing',
    type: 'expense',
    parentId: null,
    icon: '',
    color: '',
    isDefault: true,
  },
]

describe('computeInsights', () => {
  it('returns nothing fabricated when there is no data', () => {
    const insights = computeInsights(
      [account({ balanceCents: 0 })],
      [],
      categories,
      'USD',
      '2026-08-14',
    )
    expect(insights).toEqual([])
  })

  it('reports a category increase only when last month had real spending in that category', () => {
    const accounts = [account({ balanceCents: toCents('10000') })]
    const transactions: Transaction[] = [
      txn({
        categoryId: 'food',
        amountCents: toCents('100'),
        date: '2026-07-10',
        merchant: 'Groceries',
      }),
      txn({
        categoryId: 'food',
        amountCents: toCents('200'),
        date: '2026-08-10',
        merchant: 'Groceries',
      }),
    ]
    const insights = computeInsights(accounts, transactions, categories, 'USD', '2026-08-14')
    const categoryInsight = insights.find((i) => i.id === 'category-change-food')
    expect(categoryInsight?.text).toBe('You spent 100% more on Food than last month.')
  })

  it('does not claim a category change when last month had zero spending there', () => {
    const accounts = [account({ balanceCents: toCents('10000') })]
    const transactions: Transaction[] = [
      txn({ categoryId: 'food', amountCents: toCents('200'), date: '2026-08-10' }),
    ]
    const insights = computeInsights(accounts, transactions, categories, 'USD', '2026-08-14')
    expect(insights.find((i) => i.id === 'category-change-food')).toBeUndefined()
  })

  it('reports the largest expense of the month', () => {
    const accounts = [account({ balanceCents: toCents('10000') })]
    const transactions: Transaction[] = [
      txn({
        merchant: 'Rent',
        amountCents: toCents('2000'),
        date: '2026-08-01',
        categoryId: 'housing',
      }),
      txn({
        merchant: 'Coffee',
        amountCents: toCents('5'),
        date: '2026-08-02',
        categoryId: 'food',
      }),
    ]
    const insights = computeInsights(accounts, transactions, categories, 'USD', '2026-08-14')
    expect(insights.find((i) => i.id === 'largest-expense')?.text).toContain('Rent: $2,000.00')
  })

  it('reports savings comparison correctly when spending less than last month', () => {
    const accounts = [account({ balanceCents: toCents('10000') })]
    const transactions: Transaction[] = [
      txn({ type: 'income', amountCents: toCents('5000'), date: '2026-07-01' }),
      txn({ type: 'expense', amountCents: toCents('4000'), date: '2026-07-10' }),
      txn({ type: 'income', amountCents: toCents('5000'), date: '2026-08-01' }),
      txn({ type: 'expense', amountCents: toCents('1000'), date: '2026-08-10' }),
    ]
    const insights = computeInsights(accounts, transactions, categories, 'USD', '2026-08-14')
    // July net = 1000, August net = 4000 -> saved 3000 more.
    expect(insights.find((i) => i.id === 'savings-comparison')?.text).toBe(
      'You saved $3,000.00 more than last month.',
    )
  })
})
