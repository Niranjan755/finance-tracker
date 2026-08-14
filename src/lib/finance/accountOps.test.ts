import { beforeEach, describe, expect, it } from 'vitest'
import { toCents } from '@/lib/money'
import { createAccount, deleteAccountIfUnused, updateAccountMeta } from './accountOps'
import { createTransaction } from './transactionOps'
import { resetTestDB, seedAccount } from './testHelpers'

beforeEach(resetTestDB)

describe('createAccount', () => {
  it('sets the balance to the provided starting balance', async () => {
    const account = await createAccount({
      name: 'Chase Checking',
      institution: 'Chase',
      type: 'checking',
      lastFour: '4821',
      startingBalanceCents: toCents('4250.50'),
      creditLimitCents: null,
      currency: 'USD',
      icon: 'landmark',
      color: '#2563eb',
      notes: '',
    })
    expect(account.balanceCents).toBe(toCents('4250.50'))
    expect(account.isActive).toBe(true)
  })
})

describe('updateAccountMeta', () => {
  it('updates metadata without ever touching balanceCents', async () => {
    const account = await seedAccount({
      id: 'checking',
      name: 'Old Name',
      balanceCents: toCents('900'),
    })

    const updated = await updateAccountMeta(account.id, { name: 'New Name' })

    expect(updated.name).toBe('New Name')
    expect(updated.balanceCents).toBe(toCents('900'))
  })
})

describe('deleteAccountIfUnused', () => {
  it('deletes an account with no transaction history', async () => {
    const account = await seedAccount({ id: 'unused' })
    const result = await deleteAccountIfUnused(account.id)
    expect(result.deleted).toBe(true)
  })

  it('refuses to delete an account that has transactions', async () => {
    const account = await seedAccount({ id: 'used', balanceCents: toCents('1000') })
    await createTransaction({
      accountId: account.id,
      categoryId: 'cat_food',
      type: 'expense',
      amountCents: toCents('50'),
      date: '2026-08-14',
    })

    const result = await deleteAccountIfUnused(account.id)
    expect(result.deleted).toBe(false)
    expect(result.reason).toBeTruthy()
  })
})
