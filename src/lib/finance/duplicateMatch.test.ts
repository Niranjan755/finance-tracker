import { describe, expect, it } from 'vitest'
import { toCents } from '@/lib/money'
import type { Transaction } from '@/types'
import { findDuplicateManualTransaction } from './duplicateMatch'

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

describe('findDuplicateManualTransaction', () => {
  it('matches a manual transaction with the same type, amount, and date', () => {
    const manual = txn({ id: 'manual', amountCents: toCents('42'), date: '2026-08-10' })
    const candidate = { type: 'expense' as const, amountCents: toCents('42'), date: '2026-08-10' }
    expect(findDuplicateManualTransaction(candidate, [manual])?.id).toBe('manual')
  })

  it('matches when dates are within one day (pending vs posted drift)', () => {
    const manual = txn({ id: 'manual', amountCents: toCents('42'), date: '2026-08-10' })
    const candidate = { type: 'expense' as const, amountCents: toCents('42'), date: '2026-08-11' }
    expect(findDuplicateManualTransaction(candidate, [manual])?.id).toBe('manual')
  })

  it('does not match when dates are more than one day apart', () => {
    const manual = txn({ id: 'manual', amountCents: toCents('42'), date: '2026-08-10' })
    const candidate = { type: 'expense' as const, amountCents: toCents('42'), date: '2026-08-13' }
    expect(findDuplicateManualTransaction(candidate, [manual])).toBeUndefined()
  })

  it('does not match on a different amount', () => {
    const manual = txn({ id: 'manual', amountCents: toCents('42'), date: '2026-08-10' })
    const candidate = { type: 'expense' as const, amountCents: toCents('43'), date: '2026-08-10' }
    expect(findDuplicateManualTransaction(candidate, [manual])).toBeUndefined()
  })

  it('does not match on a different type', () => {
    const manual = txn({ id: 'manual', type: 'income', amountCents: toCents('42'), date: '2026-08-10' })
    const candidate = { type: 'expense' as const, amountCents: toCents('42'), date: '2026-08-10' }
    expect(findDuplicateManualTransaction(candidate, [manual])).toBeUndefined()
  })

  it('ignores transactions that already came from Plaid', () => {
    const alreadySynced = txn({
      id: 'synced',
      amountCents: toCents('42'),
      date: '2026-08-10',
      plaidTransactionId: 'plaid_1',
    })
    const candidate = { type: 'expense' as const, amountCents: toCents('42'), date: '2026-08-10' }
    expect(findDuplicateManualTransaction(candidate, [alreadySynced])).toBeUndefined()
  })

  it('picks the closest date when multiple manual transactions match', () => {
    const farther = txn({ id: 'farther', amountCents: toCents('42'), date: '2026-08-09' })
    const closer = txn({ id: 'closer', amountCents: toCents('42'), date: '2026-08-10' })
    const candidate = { type: 'expense' as const, amountCents: toCents('42'), date: '2026-08-10' }
    expect(findDuplicateManualTransaction(candidate, [farther, closer])?.id).toBe('closer')
  })
})
