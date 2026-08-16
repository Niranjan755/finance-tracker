import { beforeEach, describe, expect, it } from 'vitest'
import { getDB } from '@/lib/db/client'
import { toCents } from '@/lib/money'
import { createTransaction, deleteTransaction, updateTransaction } from './transactionOps'
import { getAccount, resetTestDB, seedAccount } from './testHelpers'

beforeEach(resetTestDB)

describe('createTransaction - expense', () => {
  it('subtracts from a checking account balance', async () => {
    const account = await seedAccount({
      id: 'checking',
      type: 'checking',
      balanceCents: toCents('1000'),
    })

    await createTransaction({
      accountId: account.id,
      categoryId: 'cat_food',
      type: 'expense',
      amountCents: toCents('100'),
      date: '2026-08-14',
    })

    const updated = await getAccount('checking')
    expect(updated.balanceCents).toBe(toCents('900'))
  })

  it('adds to a credit card balance (debt grows) instead of subtracting', async () => {
    const account = await seedAccount({
      id: 'visa',
      type: 'credit_card',
      balanceCents: toCents('1000'),
      creditLimitCents: toCents('5000'),
    })

    await createTransaction({
      accountId: account.id,
      categoryId: 'cat_shopping',
      type: 'expense',
      amountCents: toCents('500'),
      date: '2026-08-14',
    })

    const updated = await getAccount('visa')
    expect(updated.balanceCents).toBe(toCents('1500'))
  })

  it('rejects a zero or negative amount', async () => {
    await seedAccount({ id: 'checking' })
    await expect(
      createTransaction({
        accountId: 'checking',
        categoryId: 'cat_food',
        type: 'expense',
        amountCents: 0,
        date: '2026-08-14',
      }),
    ).rejects.toThrow()
    await expect(
      createTransaction({
        accountId: 'checking',
        categoryId: 'cat_food',
        type: 'expense',
        amountCents: -500,
        date: '2026-08-14',
      }),
    ).rejects.toThrow()
  })

  it('rejects an unknown account', async () => {
    await expect(
      createTransaction({
        accountId: 'does-not-exist',
        categoryId: 'cat_food',
        type: 'expense',
        amountCents: 100,
        date: '2026-08-14',
      }),
    ).rejects.toThrow('Account not found')
  })
})

describe('createTransaction - income', () => {
  it('adds to a checking account balance', async () => {
    await seedAccount({ id: 'checking', balanceCents: toCents('1000') })

    await createTransaction({
      accountId: 'checking',
      categoryId: 'cat_salary',
      type: 'income',
      amountCents: toCents('500'),
      date: '2026-08-14',
    })

    const updated = await getAccount('checking')
    expect(updated.balanceCents).toBe(toCents('1500'))
  })

  it('reduces a credit card balance when income is a refund', async () => {
    await seedAccount({ id: 'visa', type: 'credit_card', balanceCents: toCents('1000') })

    await createTransaction({
      accountId: 'visa',
      categoryId: 'cat_refund',
      type: 'income',
      amountCents: toCents('200'),
      date: '2026-08-14',
    })

    const updated = await getAccount('visa')
    expect(updated.balanceCents).toBe(toCents('800'))
  })
})

describe('updateTransaction', () => {
  it('re-derives the balance correctly when the amount changes', async () => {
    await seedAccount({ id: 'checking', balanceCents: toCents('1000') })
    const txn = await createTransaction({
      accountId: 'checking',
      categoryId: 'cat_food',
      type: 'expense',
      amountCents: toCents('100'),
      date: '2026-08-14',
    })
    // Balance is now 900.

    await updateTransaction(txn.id, {
      accountId: 'checking',
      categoryId: 'cat_food',
      type: 'expense',
      amountCents: toCents('250'),
      date: '2026-08-14',
    })

    const updated = await getAccount('checking')
    expect(updated.balanceCents).toBe(toCents('750'))
  })

  it('moves the effect from the old account to a new account', async () => {
    await seedAccount({ id: 'checking', balanceCents: toCents('1000') })
    await seedAccount({ id: 'savings', balanceCents: toCents('500') })
    const txn = await createTransaction({
      accountId: 'checking',
      categoryId: 'cat_food',
      type: 'expense',
      amountCents: toCents('100'),
      date: '2026-08-14',
    })
    // checking = 900

    await updateTransaction(txn.id, {
      accountId: 'savings',
      categoryId: 'cat_food',
      type: 'expense',
      amountCents: toCents('100'),
      date: '2026-08-14',
    })

    expect((await getAccount('checking')).balanceCents).toBe(toCents('1000'))
    expect((await getAccount('savings')).balanceCents).toBe(toCents('400'))
  })

  it('flips correctly when the type changes from expense to income', async () => {
    await seedAccount({ id: 'checking', balanceCents: toCents('1000') })
    const txn = await createTransaction({
      accountId: 'checking',
      categoryId: 'cat_food',
      type: 'expense',
      amountCents: toCents('100'),
      date: '2026-08-14',
    })
    // checking = 900

    await updateTransaction(txn.id, {
      accountId: 'checking',
      categoryId: 'cat_salary',
      type: 'income',
      amountCents: toCents('100'),
      date: '2026-08-14',
    })

    // Reverse the expense (+100) then apply income (+100) => net +200 from the 900 baseline.
    expect((await getAccount('checking')).balanceCents).toBe(toCents('1100'))
  })

  it('does not partially commit a reversal when the target account does not exist', async () => {
    await seedAccount({ id: 'checking', balanceCents: toCents('1000') })
    const txn = await createTransaction({
      accountId: 'checking',
      categoryId: 'cat_food',
      type: 'expense',
      amountCents: toCents('100'),
      date: '2026-08-14',
    })
    // checking = 900

    await expect(
      updateTransaction(txn.id, {
        accountId: 'does-not-exist',
        categoryId: 'cat_food',
        type: 'expense',
        amountCents: toCents('100'),
        date: '2026-08-14',
      }),
    ).rejects.toThrow()

    // The reversal against checking must not have been applied - it should
    // still reflect the original transaction, not have silently reverted.
    expect((await getAccount('checking')).balanceCents).toBe(toCents('900'))
  })
})

describe('deleteTransaction', () => {
  it('reverses the balance effect', async () => {
    await seedAccount({ id: 'checking', balanceCents: toCents('1000') })
    const txn = await createTransaction({
      accountId: 'checking',
      categoryId: 'cat_food',
      type: 'expense',
      amountCents: toCents('100'),
      date: '2026-08-14',
    })
    expect((await getAccount('checking')).balanceCents).toBe(toCents('900'))

    await deleteTransaction(txn.id)

    expect((await getAccount('checking')).balanceCents).toBe(toCents('1000'))
    const db = await getDB()
    expect(await db.get('transactions', txn.id)).toBeUndefined()
  })

  it('reverses a credit card expense correctly (subtracts the debt back off)', async () => {
    await seedAccount({ id: 'visa', type: 'credit_card', balanceCents: toCents('1000') })
    const txn = await createTransaction({
      accountId: 'visa',
      categoryId: 'cat_shopping',
      type: 'expense',
      amountCents: toCents('500'),
      date: '2026-08-14',
    })
    expect((await getAccount('visa')).balanceCents).toBe(toCents('1500'))

    await deleteTransaction(txn.id)

    expect((await getAccount('visa')).balanceCents).toBe(toCents('1000'))
  })
})
