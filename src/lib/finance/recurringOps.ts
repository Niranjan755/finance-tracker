import { getDate } from 'date-fns'
import { getDB } from '@/lib/db/client'
import { deleteFromStore, getAllFromStore, putInStore } from '@/lib/db/repo'
import { advanceByFrequency, parseISODate, todayISODate, toISODate } from '@/lib/date'
import { generateId } from '@/lib/id'
import type { RecurringTransaction, Transaction } from '@/types'
import { createTransaction } from './transactionOps'
import { creditDelta, debitDelta } from './math'

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
  const updated: RecurringTransaction = {
    ...existing,
    ...patch,
    updatedAt: new Date().toISOString(),
  }
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

  const anchorDay = getDate(parseISODate(recurring.startDate))
  const nextRunDate = toISODate(
    advanceByFrequency(parseISODate(recurring.nextRunDate), recurring.frequency, anchorDay),
  )
  await putInStore('recurring', { ...recurring, nextRunDate, updatedAt: new Date().toISOString() })

  return transaction
}

/**
 * Auto-posts every due occurrence (nextRunDate <= today) for every active,
 * not-yet-ended recurring item. Only called when the user has opted into
 * automatic generation via Settings, or after confirming a catch-up backlog.
 *
 * Everything for every rule runs inside one shared transaction, so two
 * overlapping calls (two tabs open, a double-fired effect) can't both read
 * the same stale nextRunDate and double-post - IndexedDB serializes
 * readwrite transactions with overlapping object-store scope. The
 * transaction-creation logic below duplicates a small amount of
 * `createTransaction`'s logic rather than calling it directly, since that
 * function opens its own separate transaction and can't share this one.
 */
export async function generateDueOccurrences(today = todayISODate()): Promise<number> {
  const db = await getDB()
  const tx = db.transaction(['recurring', 'transactions', 'accounts'], 'readwrite')
  const recurringStore = tx.objectStore('recurring')
  const transactionsStore = tx.objectStore('transactions')
  const accountsStore = tx.objectStore('accounts')

  const allRecurring = await recurringStore.getAll()
  let postedCount = 0

  for (const recurring of allRecurring) {
    if (!recurring.isActive) continue
    const anchorDay = getDate(parseISODate(recurring.startDate))
    let cursor = recurring
    let guard = 0
    while (
      cursor.nextRunDate <= today &&
      (!cursor.endDate || cursor.nextRunDate <= cursor.endDate) &&
      guard < 60
    ) {
      const account = await accountsStore.get(cursor.accountId)
      if (!account) break // the account was deleted; stop generating for this rule

      const now = new Date().toISOString()
      const delta =
        cursor.type === 'expense'
          ? debitDelta(account.type, cursor.amountCents)
          : creditDelta(account.type, cursor.amountCents)
      await accountsStore.put({
        ...account,
        balanceCents: account.balanceCents + delta,
        updatedAt: now,
      })

      const transaction: Transaction = {
        id: generateId('txn'),
        accountId: cursor.accountId,
        categoryId: cursor.categoryId,
        type: cursor.type,
        amountCents: cursor.amountCents,
        merchant: cursor.name,
        description: '',
        date: cursor.nextRunDate,
        notes: '',
        tags: [],
        location: '',
        receiptId: null,
        recurringId: cursor.id,
        createdAt: now,
        updatedAt: now,
      }
      await transactionsStore.put(transaction)

      const nextRunDate = toISODate(
        advanceByFrequency(parseISODate(cursor.nextRunDate), cursor.frequency, anchorDay),
      )
      cursor = { ...cursor, nextRunDate, updatedAt: now }
      postedCount += 1
      guard += 1
    }
    if (guard > 0) {
      await recurringStore.put(cursor)
    }
  }

  await tx.done
  return postedCount
}
