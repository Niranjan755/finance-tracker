import { describe, expect, it } from 'vitest'
import { getMonthBounds } from '@/lib/date'
import { convertCentsToCurrency, toCents } from '@/lib/money'
import type { Account, Budget, Category, Transaction, Transfer } from '@/types'
import {
  budgetStatusFor,
  computeAccountTotals,
  computeAverageMonthlySpending,
  computeBudgetProgress,
  computeBudgetProgressWithRollover,
  computeCategoryBreakdown,
  computeMonthlyStatement,
  computeSpendingByAccount,
  netWorthAsOf,
  suggestCategoryForMerchant,
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
    plaidAccountId: null,
    plaidItemId: null,
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
    plaidTransactionId: null,
    possibleDuplicateOfId: null,
    createdAt: '',
    updatedAt: '',
    ...overrides,
  }
}

describe('computeAccountTotals', () => {
  it('matches the spec example: checking 4250, credit card -820/5000, cash 350', () => {
    const totals = computeAccountTotals(
      [
        account({ id: 'checking', type: 'checking', balanceCents: toCents('4250') }),
        account({
          id: 'visa',
          type: 'credit_card',
          balanceCents: toCents('820'),
          creditLimitCents: toCents('5000'),
        }),
        account({ id: 'cash', type: 'cash', balanceCents: toCents('350') }),
      ],
      'USD',
    )

    expect(totals.totalAssetsCents).toBe(toCents('4600'))
    expect(totals.totalLiabilitiesCents).toBe(toCents('820'))
    // Net worth is asset accounts only - credit card debt is never netted
    // against it, it's shown as its own separate figure.
    expect(totals.netWorthCents).toBe(toCents('4600'))
    expect(totals.availableCashCents).toBe(toCents('4600'))
    expect(totals.creditCardDebtCents).toBe(toCents('820'))
  })

  it('excludes inactive accounts', () => {
    const totals = computeAccountTotals(
      [
        account({ id: 'a', balanceCents: toCents('100'), isActive: true }),
        account({ id: 'b', balanceCents: toCents('900'), isActive: false }),
      ],
      'USD',
    )
    expect(totals.totalAssetsCents).toBe(toCents('100'))
  })

  it('keeps each currency native in byCurrency, but converts the flat totals into the target currency', () => {
    const totals = computeAccountTotals(
      [
        account({ id: 'usd', type: 'checking', currency: 'USD', balanceCents: toCents('107') }),
        account({ id: 'inr', type: 'checking', currency: 'INR', balanceCents: toCents('10000') }),
      ],
      'USD',
    )

    const inrInUsd = convertCentsToCurrency(toCents('10000'), 'INR', 'USD')
    expect(totals.totalAssetsCents).toBe(toCents('107') + inrInUsd)
    expect(totals.netWorthCents).toBe(toCents('107') + inrInUsd)
    // byCurrency stays native/unconverted - this is the correct per-currency breakdown.
    expect(totals.byCurrency.USD.netWorthCents).toBe(toCents('107'))
    expect(totals.byCurrency.INR.netWorthCents).toBe(toCents('10000'))
  })

  it('converts a non-USD account into a non-USD target currency', () => {
    const totals = computeAccountTotals(
      [account({ id: 'usd', type: 'checking', currency: 'USD', balanceCents: toCents('100') })],
      'INR',
    )
    expect(totals.totalAssetsCents).toBe(convertCentsToCurrency(toCents('100'), 'USD', 'INR'))
  })
})

describe('netWorthAsOf', () => {
  it('is unaffected by a credit card balance, however large', () => {
    const accounts = [
      account({ id: 'checking', type: 'checking', balanceCents: toCents('1000') }),
      account({
        id: 'visa',
        type: 'credit_card',
        balanceCents: toCents('50000'),
        creditLimitCents: toCents('60000'),
      }),
    ]
    expect(netWorthAsOf(accounts, [], '2026-08-14', 'USD')).toBe(toCents('1000'))
  })

  it('does not roll back a credit card transaction, since it was never counted', () => {
    const accounts = [
      account({ id: 'checking', type: 'checking', balanceCents: toCents('1000') }),
      account({ id: 'visa', type: 'credit_card', balanceCents: toCents('300') }),
    ]
    const transactions: Transaction[] = [
      txn({ accountId: 'visa', type: 'expense', amountCents: toCents('300'), date: '2026-08-10' }),
    ]
    // Asking for net worth before the credit card expense happened must still
    // equal today's asset-only net worth - the expense never touched it.
    expect(netWorthAsOf(accounts, transactions, '2026-08-05', 'USD')).toBe(toCents('1000'))
  })

  it('still rolls back a checking-account transaction correctly', () => {
    const accounts = [account({ id: 'checking', type: 'checking', balanceCents: toCents('1000') })]
    const transactions: Transaction[] = [
      txn({ accountId: 'checking', type: 'expense', amountCents: toCents('300'), date: '2026-08-10' }),
    ]
    expect(netWorthAsOf(accounts, transactions, '2026-08-05', 'USD')).toBe(toCents('1300'))
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
    const statement = computeMonthlyStatement(accounts, transactions, transfers, bounds, 'USD')

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
    const statement = computeMonthlyStatement(accounts, transactions, [], bounds, 'USD')
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
        fromAmountCents: toCents('300'),
        toAmountCents: toCents('300'),
        exchangeRate: 1,
        date: '2026-08-10',
        description: '',
        isCreditCardPayment: false,
        createdAt: '',
      },
    ]
    const bounds = getMonthBounds(2026, 8)
    const statement = computeMonthlyStatement([checking, savings], [], transfers, bounds, 'USD')
    // No income/expense at all: opening must equal closing despite the transfer.
    expect(statement.openingBalanceCents).toBe(statement.closingBalanceCents)
    expect(statement.closingBalanceCents).toBe(toCents('1500'))
  })
})

describe('computeCategoryBreakdown', () => {
  it('groups by top-level category and computes percentages', () => {
    const categories: Category[] = [
      {
        id: 'housing',
        name: 'Housing',
        type: 'expense',
        parentId: null,
        icon: '',
        color: '',
        isDefault: true,
      },
      {
        id: 'rent',
        name: 'Rent',
        type: 'expense',
        parentId: 'housing',
        icon: '',
        color: '',
        isDefault: true,
      },
      {
        id: 'food',
        name: 'Food',
        type: 'expense',
        parentId: null,
        icon: '',
        color: '',
        isDefault: true,
      },
    ]
    const transactions: Transaction[] = [
      txn({ type: 'expense', categoryId: 'rent', amountCents: toCents('300') }),
      txn({ type: 'expense', categoryId: 'food', amountCents: toCents('100') }),
    ]
    const breakdown = computeCategoryBreakdown(transactions, categories, [], 'USD')
    expect(breakdown).toEqual([
      {
        categoryId: 'housing',
        name: 'Housing',
        icon: '',
        color: '',
        amountCents: toCents('300'),
        percent: 75,
      },
      {
        categoryId: 'food',
        name: 'Food',
        icon: '',
        color: '',
        amountCents: toCents('100'),
        percent: 25,
      },
    ])
  })

  it('converts a mixed-currency transaction into the target currency instead of raw-summing it', () => {
    const categories: Category[] = [
      { id: 'food', name: 'Food', type: 'expense', parentId: null, icon: '', color: '', isDefault: true },
    ]
    const accounts = [
      account({ id: 'usd-acct', currency: 'USD' }),
      account({ id: 'inr-acct', currency: 'INR' }),
    ]
    const transactions: Transaction[] = [
      txn({ accountId: 'usd-acct', type: 'expense', categoryId: 'food', amountCents: toCents('50') }),
      txn({ accountId: 'inr-acct', type: 'expense', categoryId: 'food', amountCents: toCents('5000') }),
    ]
    const breakdown = computeCategoryBreakdown(transactions, categories, accounts, 'USD')
    const expected = toCents('50') + convertCentsToCurrency(toCents('5000'), 'INR', 'USD')
    expect(breakdown[0]?.amountCents).toBe(expected)
    // The old bug summed raw cents (505000); the fix must not match that.
    expect(breakdown[0]?.amountCents).not.toBe(toCents('50') + toCents('5000'))
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
      {
        id: 'food',
        name: 'Food',
        type: 'expense',
        parentId: null,
        icon: '',
        color: '',
        isDefault: true,
      },
    ]
    const budgets: Budget[] = [
      {
        id: 'b1',
        categoryId: 'food',
        month: 8,
        year: 2026,
        amountCents: toCents('600'),
        rolloverEnabled: false,
      },
    ]
    const transactions: Transaction[] = [
      txn({ categoryId: 'food', amountCents: toCents('425'), date: '2026-08-10' }),
    ]
    const [progress] = computeBudgetProgress(budgets, transactions, categories, [], 'USD')
    expect(progress?.spentCents).toBe(toCents('425'))
    expect(progress?.remainingCents).toBe(toCents('175'))
    expect(progress?.status).toBe('normal')
  })

  it('includes spending from subcategories under a parent budget', () => {
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
        id: 'restaurants',
        name: 'Restaurants',
        type: 'expense',
        parentId: 'food',
        icon: '',
        color: '',
        isDefault: true,
      },
    ]
    const budgets: Budget[] = [
      {
        id: 'b1',
        categoryId: 'food',
        month: 8,
        year: 2026,
        amountCents: toCents('600'),
        rolloverEnabled: false,
      },
    ]
    const transactions: Transaction[] = [
      txn({ categoryId: 'restaurants', amountCents: toCents('100'), date: '2026-08-10' }),
    ]
    const [progress] = computeBudgetProgress(budgets, transactions, categories, [], 'USD')
    expect(progress?.spentCents).toBe(toCents('100'))
  })
})

describe('computeBudgetProgressWithRollover', () => {
  const foodCategory: Category = {
    id: 'food',
    name: 'Food',
    type: 'expense',
    parentId: null,
    icon: '',
    color: '',
    isDefault: true,
  }

  function budget(overrides: Partial<Budget> = {}): Budget {
    return {
      id: `b_${Math.random()}`,
      categoryId: 'food',
      month: 8,
      year: 2026,
      amountCents: toCents('600'),
      rolloverEnabled: true,
      ...overrides,
    }
  }

  it('carries unspent amount from a rollover-enabled prior month into the current month', () => {
    const july = budget({ id: 'july', month: 7, year: 2026, amountCents: toCents('600') })
    const august = budget({ id: 'august', month: 8, year: 2026, amountCents: toCents('600') })
    const transactions: Transaction[] = [
      // July: spent 400 of 600 -> 200 unspent rolls into August.
      txn({ categoryId: 'food', amountCents: toCents('400'), date: '2026-07-15' }),
      txn({ categoryId: 'food', amountCents: toCents('300'), date: '2026-08-10' }),
    ]
    const [progress] = computeBudgetProgressWithRollover(
      [july, august],
      transactions,
      [foodCategory],
      [],
      'USD',
      8,
      2026,
    )
    expect(progress?.rolloverCents).toBe(toCents('200'))
    expect(progress?.effectiveLimitCents).toBe(toCents('800'))
    expect(progress?.remainingCents).toBe(toCents('500'))
  })

  it('does not carry a debt forward when the prior month was overspent', () => {
    const july = budget({ id: 'july', month: 7, year: 2026, amountCents: toCents('600') })
    const august = budget({ id: 'august', month: 8, year: 2026, amountCents: toCents('600') })
    const transactions: Transaction[] = [
      // July: overspent by 100.
      txn({ categoryId: 'food', amountCents: toCents('700'), date: '2026-07-15' }),
    ]
    const [progress] = computeBudgetProgressWithRollover(
      [july, august],
      transactions,
      [foodCategory],
      [],
      'USD',
      8,
      2026,
    )
    expect(progress?.rolloverCents).toBe(0)
    expect(progress?.effectiveLimitCents).toBe(toCents('600'))
  })

  it('does not roll over when the current budget has rollover disabled', () => {
    const july = budget({ id: 'july', month: 7, year: 2026, amountCents: toCents('600') })
    const august = budget({
      id: 'august',
      month: 8,
      year: 2026,
      amountCents: toCents('600'),
      rolloverEnabled: false,
    })
    const transactions: Transaction[] = [
      txn({ categoryId: 'food', amountCents: toCents('400'), date: '2026-07-15' }),
    ]
    const [progress] = computeBudgetProgressWithRollover(
      [july, august],
      transactions,
      [foodCategory],
      [],
      'USD',
      8,
      2026,
    )
    expect(progress?.rolloverCents).toBe(0)
  })

  it('stops the chain at a month with no prior budget row', () => {
    // No July budget exists at all - August has nothing to inherit from.
    const august = budget({ id: 'august', month: 8, year: 2026, amountCents: toCents('600') })
    const [progress] = computeBudgetProgressWithRollover(
      [august],
      [],
      [foodCategory],
      [],
      'USD',
      8,
      2026,
    )
    expect(progress?.rolloverCents).toBe(0)
  })

  it('chains rollover across multiple consecutive months', () => {
    const june = budget({ id: 'june', month: 6, year: 2026, amountCents: toCents('600') })
    const july = budget({ id: 'july', month: 7, year: 2026, amountCents: toCents('600') })
    const august = budget({ id: 'august', month: 8, year: 2026, amountCents: toCents('600') })
    const transactions: Transaction[] = [
      // June: spent 500 of 600 -> 100 unspent rolls into July.
      txn({ categoryId: 'food', amountCents: toCents('500'), date: '2026-06-15' }),
      // July: budget becomes 700 (600 + 100 rollover), spent 550 -> 150 unspent rolls into August.
      txn({ categoryId: 'food', amountCents: toCents('550'), date: '2026-07-15' }),
    ]
    const [progress] = computeBudgetProgressWithRollover(
      [june, july, august],
      transactions,
      [foodCategory],
      [],
      'USD',
      8,
      2026,
    )
    expect(progress?.rolloverCents).toBe(toCents('150'))
    expect(progress?.effectiveLimitCents).toBe(toCents('750'))
  })
})

describe('suggestCategoryForMerchant', () => {
  it('returns the most frequent category for past transactions at this merchant', () => {
    const transactions: Transaction[] = [
      txn({ merchant: 'Olive Garden', categoryId: 'dining', type: 'expense' }),
      txn({ merchant: 'Olive Garden', categoryId: 'dining', type: 'expense' }),
      txn({ merchant: 'Olive Garden', categoryId: 'groceries', type: 'expense' }),
    ]
    expect(suggestCategoryForMerchant('Olive Garden', 'expense', transactions)).toBe('dining')
  })

  it('matches merchant case-insensitively and trims whitespace', () => {
    const transactions: Transaction[] = [
      txn({ merchant: 'Olive Garden', categoryId: 'dining', type: 'expense' }),
    ]
    expect(suggestCategoryForMerchant('  olive garden  ', 'expense', transactions)).toBe('dining')
  })

  it('only matches transactions of the same type', () => {
    const transactions: Transaction[] = [
      txn({ merchant: 'Acme Corp', categoryId: 'salary', type: 'income' }),
    ]
    expect(suggestCategoryForMerchant('Acme Corp', 'expense', transactions)).toBeUndefined()
  })

  it('returns undefined for an empty merchant or no history', () => {
    expect(suggestCategoryForMerchant('', 'expense', [])).toBeUndefined()
    expect(suggestCategoryForMerchant('Unknown Merchant', 'expense', [])).toBeUndefined()
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
    const result = computeSpendingByAccount(transactions, accounts, 'USD')
    expect(result).toEqual([
      {
        accountId: 'checking',
        name: 'Account',
        color: '#111',
        amountCents: toCents('300'),
        percent: 75,
      },
      {
        accountId: 'visa',
        name: 'Account',
        color: '#222',
        amountCents: toCents('100'),
        percent: 25,
      },
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
    expect(computeAverageMonthlySpending(transactions, [], 'USD')).toBe(toCents('200'))
  })

  it('returns 0 when there is no expense data', () => {
    expect(computeAverageMonthlySpending([], [], 'USD')).toBe(0)
  })
})
