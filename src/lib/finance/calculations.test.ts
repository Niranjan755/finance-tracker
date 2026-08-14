import { describe, expect, it } from 'vitest'
import { getMonthBounds } from '@/lib/date'
import { toCents } from '@/lib/money'
import type { Account, Budget, Category, Transaction, Transfer } from '@/types'
import {
  budgetStatusFor,
  computeAccountTotals,
  computeAverageMonthlySpending,
  computeBudgetProgress,
  computeCategoryBreakdown,
  computeMonthlyStatement,
  computeSpendingByAccount,
} from './calculations'

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

describe('computeAccountTotals', () => {
  it('matches the spec example: checking 4250, credit card -820/5000, cash 350', () => {
    const totals = computeAccountTotals([
      account({ id: 'checking', type: 'checking', balanceCents: toCents('4250') }),
      account({
        id: 'visa',
        type: 'credit_card',
        balanceCents: toCents('820'),
        creditLimitCents: toCents('5000'),
      }),
      account({ id: 'cash', type: 'cash', balanceCents: toCents('350') }),
    ])

    expect(totals.totalAssetsCents).toBe(toCents('4600'))
    expect(totals.totalLiabilitiesCents).toBe(toCents('820'))
    expect(totals.netWorthCents).toBe(toCents('3780'))
    expect(totals.availableCashCents).toBe(toCents('4600'))
    expect(totals.creditCardDebtCents).toBe(toCents('820'))
  })

  it('excludes inactive accounts', () => {
    const totals = computeAccountTotals([
      account({ id: 'a', balanceCents: toCents('100'), isActive: true }),
      account({ id: 'b', balanceCents: toCents('900'), isActive: false }),
    ])
    expect(totals.totalAssetsCents).toBe(toCents('100'))
  })
})

describe('computeMonthlyStatement', () => {
  it('matches the spec worked example exactly', () => {
    const accounts = [account({ id: 'checking', balanceCents: toCents('13320') })]
    const transactions: Transaction[] = [
      txn({ type: 'income', amountCents: toCents('9050'), date: '2026-08-05' }),
      txn({ type: 'expense', amountCents: toCents('4180'), date: '2026-08-10' }),
    ]
    const transfers: Transfer[] = []

    const bounds = getMonthBounds(2026, 8)
    const statement = computeMonthlyStatement(accounts, transactions, transfers, bounds)

    expect(statement.totalIncomeCents).toBe(toCents('9050'))
    expect(statement.totalExpenseCents).toBe(toCents('4180'))
    expect(statement.netCashFlowCents).toBe(toCents('4870'))
    expect(statement.closingBalanceCents).toBe(toCents('13320'))
    expect(statement.openingBalanceCents).toBe(toCents('8450'))
  })

  it('excludes transactions outside the month', () => {
    const accounts = [account({ balanceCents: toCents('1000') })]
    const transactions: Transaction[] = [
      txn({ type: 'income', amountCents: toCents('500'), date: '2026-07-31' }),
      txn({ type: 'expense', amountCents: toCents('100'), date: '2026-09-01' }),
      txn({ type: 'income', amountCents: toCents('200'), date: '2026-08-15' }),
    ]
    const bounds = getMonthBounds(2026, 8)
    const statement = computeMonthlyStatement(accounts, transactions, [], bounds)
    expect(statement.totalIncomeCents).toBe(toCents('200'))
    expect(statement.totalExpenseCents).toBe(0)
  })

  it('leaves net worth unaffected by transfers between own accounts', () => {
    const checking = account({ id: 'checking', balanceCents: toCents('700') })
    const savings = account({ id: 'savings', balanceCents: toCents('800') })
    const transfers: Transfer[] = [
      {
        id: 'xfer_1',
        fromAccountId: 'checking',
        toAccountId: 'savings',
        amountCents: toCents('300'),
        date: '2026-08-10',
        description: '',
        isCreditCardPayment: false,
        createdAt: '',
      },
    ]
    const bounds = getMonthBounds(2026, 8)
    const statement = computeMonthlyStatement([checking, savings], [], transfers, bounds)
    // No income/expense at all: opening must equal closing despite the transfer.
    expect(statement.openingBalanceCents).toBe(statement.closingBalanceCents)
    expect(statement.closingBalanceCents).toBe(toCents('1500'))
  })
})

describe('computeCategoryBreakdown', () => {
  it('groups by top-level category and computes percentages', () => {
    const categories: Category[] = [
      { id: 'housing', name: 'Housing', type: 'expense', parentId: null, icon: '', color: '', isDefault: true },
      { id: 'rent', name: 'Rent', type: 'expense', parentId: 'housing', icon: '', color: '', isDefault: true },
      { id: 'food', name: 'Food', type: 'expense', parentId: null, icon: '', color: '', isDefault: true },
    ]
    const transactions: Transaction[] = [
      txn({ type: 'expense', categoryId: 'rent', amountCents: toCents('300') }),
      txn({ type: 'expense', categoryId: 'food', amountCents: toCents('100') }),
    ]
    const breakdown = computeCategoryBreakdown(transactions, categories)
    expect(breakdown).toEqual([
      { categoryId: 'housing', name: 'Housing', icon: '', color: '', amountCents: toCents('300'), percent: 75 },
      { categoryId: 'food', name: 'Food', icon: '', color: '', amountCents: toCents('100'), percent: 25 },
    ])
  })
})

describe('budgetStatusFor', () => {
  it('classifies thresholds per spec: <75 normal, 75-90 warning, >90 near-limit, >100 over', () => {
    expect(budgetStatusFor(50)).toBe('normal')
    expect(budgetStatusFor(74.9)).toBe('normal')
    expect(budgetStatusFor(80)).toBe('warning')
    expect(budgetStatusFor(92)).toBe('near-limit')
    expect(budgetStatusFor(101)).toBe('over-budget')
  })
})

describe('computeBudgetProgress', () => {
  it('matches the spec example: Food budget 600, spent 425, remaining 175', () => {
    const categories: Category[] = [
      { id: 'food', name: 'Food', type: 'expense', parentId: null, icon: '', color: '', isDefault: true },
    ]
    const budgets: Budget[] = [{ id: 'b1', categoryId: 'food', month: 8, year: 2026, amountCents: toCents('600') }]
    const transactions: Transaction[] = [
      txn({ categoryId: 'food', amountCents: toCents('425'), date: '2026-08-10' }),
    ]
    const [progress] = computeBudgetProgress(budgets, transactions, categories)
    expect(progress?.spentCents).toBe(toCents('425'))
    expect(progress?.remainingCents).toBe(toCents('175'))
    expect(progress?.status).toBe('normal')
  })

  it('includes spending from subcategories under a parent budget', () => {
    const categories: Category[] = [
      { id: 'food', name: 'Food', type: 'expense', parentId: null, icon: '', color: '', isDefault: true },
      { id: 'restaurants', name: 'Restaurants', type: 'expense', parentId: 'food', icon: '', color: '', isDefault: true },
    ]
    const budgets: Budget[] = [{ id: 'b1', categoryId: 'food', month: 8, year: 2026, amountCents: toCents('600') }]
    const transactions: Transaction[] = [
      txn({ categoryId: 'restaurants', amountCents: toCents('100'), date: '2026-08-10' }),
    ]
    const [progress] = computeBudgetProgress(budgets, transactions, categories)
    expect(progress?.spentCents).toBe(toCents('100'))
  })
})

describe('computeSpendingByAccount', () => {
  it('sums expenses per account and computes percentages', () => {
    const accounts = [
      account({ id: 'checking', color: '#111' }),
      account({ id: 'visa', color: '#222' }),
    ]
    const transactions: Transaction[] = [
      txn({ accountId: 'checking', amountCents: toCents('300') }),
      txn({ accountId: 'visa', amountCents: toCents('100') }),
      txn({ accountId: 'checking', type: 'income', amountCents: toCents('9999') }),
    ]
    const result = computeSpendingByAccount(transactions, accounts)
    expect(result).toEqual([
      { accountId: 'checking', name: 'Account', color: '#111', amountCents: toCents('300'), percent: 75 },
      { accountId: 'visa', name: 'Account', color: '#222', amountCents: toCents('100'), percent: 25 },
    ])
  })
})

describe('computeAverageMonthlySpending', () => {
  it('averages expense totals across distinct months', () => {
    const transactions: Transaction[] = [
      txn({ type: 'expense', amountCents: toCents('100'), date: '2026-06-01' }),
      txn({ type: 'expense', amountCents: toCents('300'), date: '2026-07-01' }),
      txn({ type: 'income', amountCents: toCents('99999'), date: '2026-07-05' }),
    ]
    expect(computeAverageMonthlySpending(transactions)).toBe(toCents('200'))
  })

  it('returns 0 when there is no expense data', () => {
    expect(computeAverageMonthlySpending([])).toBe(0)
  })
})
