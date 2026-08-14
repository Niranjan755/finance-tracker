import { beforeEach, describe, expect, it } from 'vitest'
import { getDB } from '@/lib/db/client'
import { toCents } from '@/lib/money'
import { createTransfer, deleteTransfer } from './transferOps'
import { getAccount, resetTestDB, seedAccount } from './testHelpers'

beforeEach(resetTestDB)

describe('createTransfer', () => {
  it('moves money between two asset accounts without net change', async () => {
    await seedAccount({ id: 'checking', balanceCents: toCents('1000') })
    await seedAccount({ id: 'savings', balanceCents: toCents('500') })

    await createTransfer({
      fromAccountId: 'checking',
      toAccountId: 'savings',
      fromAmountCents: toCents('300'),
      toAmountCents: toCents('300'),
      exchangeRate: 1,
      date: '2026-08-14',
    })

    expect((await getAccount('checking')).balanceCents).toBe(toCents('700'))
    expect((await getAccount('savings')).balanceCents).toBe(toCents('800'))
  })

  it('does not write anything to the transactions store', async () => {
    await seedAccount({ id: 'checking', balanceCents: toCents('1000') })
    await seedAccount({ id: 'savings', balanceCents: toCents('500') })

    await createTransfer({
      fromAccountId: 'checking',
      toAccountId: 'savings',
      fromAmountCents: toCents('300'),
      toAmountCents: toCents('300'),
      exchangeRate: 1,
      date: '2026-08-14',
    })

    const db = await getDB()
    expect(await db.getAll('transactions')).toHaveLength(0)
    expect(await db.getAll('transfers')).toHaveLength(1)
  })

  it('handles a credit card payment: reduces checking and reduces card debt, not an expense', async () => {
    await seedAccount({ id: 'checking', balanceCents: toCents('2000') })
    await seedAccount({
      id: 'visa',
      type: 'credit_card',
      balanceCents: toCents('820'),
      creditLimitCents: toCents('5000'),
    })

    await createTransfer({
      fromAccountId: 'checking',
      toAccountId: 'visa',
      fromAmountCents: toCents('500'),
      toAmountCents: toCents('500'),
      exchangeRate: 1,
      date: '2026-08-14',
      isCreditCardPayment: true,
    })

    expect((await getAccount('checking')).balanceCents).toBe(toCents('1500'))
    expect((await getAccount('visa')).balanceCents).toBe(toCents('320'))
    const db = await getDB()
    expect(await db.getAll('transactions')).toHaveLength(0)
  })

  it('rejects transferring an account to itself', async () => {
    await seedAccount({ id: 'checking' })
    await expect(
      createTransfer({
        fromAccountId: 'checking',
        toAccountId: 'checking',
        fromAmountCents: toCents('100'),
        toAmountCents: toCents('100'),
        exchangeRate: 1,
        date: '2026-08-14',
      }),
    ).rejects.toThrow()
  })

  it('rejects a non-positive amount', async () => {
    await seedAccount({ id: 'checking' })
    await seedAccount({ id: 'savings' })
    await expect(
      createTransfer({
        fromAccountId: 'checking',
        toAccountId: 'savings',
        fromAmountCents: 0,
        toAmountCents: 0,
        exchangeRate: 1,
        date: '2026-08-14',
      }),
    ).rejects.toThrow()
  })
})

describe('deleteTransfer', () => {
  it('reverses both sides of the transfer', async () => {
    await seedAccount({ id: 'checking', balanceCents: toCents('1000') })
    await seedAccount({ id: 'savings', balanceCents: toCents('500') })
    const transfer = await createTransfer({
      fromAccountId: 'checking',
      toAccountId: 'savings',
      fromAmountCents: toCents('300'),
      toAmountCents: toCents('300'),
      exchangeRate: 1,
      date: '2026-08-14',
    })

    await deleteTransfer(transfer.id)

    expect((await getAccount('checking')).balanceCents).toBe(toCents('1000'))
    expect((await getAccount('savings')).balanceCents).toBe(toCents('500'))
  })
})
