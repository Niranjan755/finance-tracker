import { deleteFromStore, getAllFromStore, putInStore } from '@/lib/db/repo'
import { advanceByFrequency, parseISODate, todayISODate, toISODate } from '@/lib/date'
import { generateId } from '@/lib/id'
import type { RecurringTransaction } from '@/types'
import { createTransaction } from './transactionOps'

export interface RecurringInput {
  name: string
  accountId: string
  categoryId: string
  type: RecurringTransaction['type']
  amountCents: number
  frequency: RecurringTransaction['frequency']
  startDate: string
  endDate: string | null
}

export async function createRecurring(input: RecurringInput): Promise<RecurringTransaction> {
  const now = new Date().toISOString()
  const recurring: RecurringTransaction = {
    id: generateId('rec'),
    name: input.name,
    accountId: input.accountId,
    categoryId: input.categoryId,
    type: input.type,
    amountCents: input.amountCents,
    frequency: input.frequency,
    startDate: input.startDate,
    endDate: input.endDate,
    nextRunDate: input.startDate,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  }
  await putInStore('recurring', recurring)
  return recurring
}

export async function updateRecurring(
  id: string,
  patch: Partial<Omit<RecurringTransaction, 'id' | 'createdAt'>>,
): Promise<RecurringTransaction> {
  const existing = (await getAllFromStore('recurring')).find((r) => r.id === id)
  if (!existing) throw new Error('Recurring transaction not found')
  const updated: RecurringTransaction = { ...existing, ...patch, updatedAt: new Date().toISOString() }
  await putInStore('recurring', updated)
  return updated
}

export async function deleteRecurring(id: string): Promise<void> {
  await deleteFromStore('recurring', id)
}

/**
 * Records exactly one occurrence of a recurring item right now, posting a
 * real transaction and advancing nextRunDate by a single period. This is the
 * explicit, user-confirmed path from the Upcoming page.
 */
export async function recordRecurringNow(id: string, date = todayISODate()) {
  const recurring = (await getAllFromStore('recurring')).find((r) => r.id === id)
  if (!recurring) throw new Error('Recurring transaction not found')

  const transaction = await createTransaction({
    accountId: recurring.accountId,
    categoryId: recurring.categoryId,
    type: recurring.type,
    amountCents: recurring.amountCents,
    date,
    merchant: recurring.name,
    recurringId: recurring.id,
  })

  const nextRunDate = toISODate(advanceByFrequency(parseISODate(recurring.nextRunDate), recurring.frequency))
  await putInStore('recurring', { ...recurring, nextRunDate, updatedAt: new Date().toISOString() })

  return transaction
}

/**
 * Auto-posts every due occurrence (nextRunDate <= today) for every active,
 * not-yet-ended recurring item. Only called when the user has opted into
 * automatic generation via Settings.
 */
export async function generateDueOccurrences(today = todayISODate()): Promise<number> {
  const allRecurring = await getAllFromStore('recurring')
  let postedCount = 0

  for (const recurring of allRecurring) {
    if (!recurring.isActive) continue
    let cursor = recurring
    let guard = 0
    while (cursor.nextRunDate <= today && (!cursor.endDate || cursor.nextRunDate <= cursor.endDate) && guard < 60) {
      await createTransaction({
        accountId: cursor.accountId,
        categoryId: cursor.categoryId,
        type: cursor.type,
        amountCents: cursor.amountCents,
        date: cursor.nextRunDate,
        merchant: cursor.name,
        recurringId: cursor.id,
      })
      const nextRunDate = toISODate(advanceByFrequency(parseISODate(cursor.nextRunDate), cursor.frequency))
      cursor = { ...cursor, nextRunDate, updatedAt: new Date().toISOString() }
      postedCount += 1
      guard += 1
    }
    if (guard > 0) {
      await putInStore('recurring', cursor)
    }
  }

  return postedCount
}
