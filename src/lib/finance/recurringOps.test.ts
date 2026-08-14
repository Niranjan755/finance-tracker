import { beforeEach, describe, expect, it } from 'vitest'
import { getAllFromStore } from '@/lib/db/repo'
import { toCents } from '@/lib/money'
import { createRecurring, generateDueOccurrences, recordRecurringNow } from './recurringOps'
import { getAccount, resetTestDB, seedAccount } from './testHelpers'

beforeEach(resetTestDB)

describe('recordRecurringNow', () => {
  it('posts one transaction and advances nextRunDate by one period', async () => {
    await seedAccount({ id: 'checking', balanceCents: toCents('1000') })
    const rent = await createRecurring({
      name: 'Rent',
      accountId: 'checking',
      categoryId: 'cat_exp_housing_rent',
      type: 'expense',
      amountCents: toCents('2000'),
      frequency: 'monthly',
      startDate: '2026-08-31',
      endDate: null,
    })

    await recordRecurringNow(rent.id, '2026-08-31')

    expect((await getAccount('checking')).balanceCents).toBe(toCents('-1000'))
    const recurring = await getAllFromStore('recurring')
    expect(recurring[0]?.nextRunDate).toBe('2026-09-30')
    const transactions = await getAllFromStore('transactions')
    expect(transactions).toHaveLength(1)
    expect(transactions[0]?.recurringId).toBe(rent.id)
  })
})

describe('generateDueOccurrences', () => {
  it('posts nothing when nothing is due', async () => {
    await seedAccount({ id: 'checking' })
    await createRecurring({
      name: 'Rent',
      accountId: 'checking',
      categoryId: 'cat_exp_housing_rent',
      type: 'expense',
      amountCents: toCents('2000'),
      frequency: 'monthly',
      startDate: '2099-01-01',
      endDate: null,
    })

    const count = await generateDueOccurrences('2026-08-14')
    expect(count).toBe(0)
  })

  it('catches up multiple missed occurrences in one pass', async () => {
    await seedAccount({ id: 'checking', balanceCents: 0 })
    await createRecurring({
      name: 'Netflix',
      accountId: 'checking',
      categoryId: 'cat_exp_entertainment_streaming',
      type: 'expense',
      amountCents: toCents('20'),
      frequency: 'monthly',
      startDate: '2026-05-01',
      endDate: null,
    })

    // As of August, May/June/July/August occurrences are all due.
    const count = await generateDueOccurrences('2026-08-14')
    expect(count).toBe(4)
    expect((await getAccount('checking')).balanceCents).toBe(toCents('-80'))
  })
})
