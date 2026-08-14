import { advanceByFrequency, parseISODate, toISODate } from '@/lib/date'
import type { RecurringTransaction } from '@/types'

export interface ProjectedOccurrence {
  recurringId: string
  name: string
  accountId: string
  categoryId: string
  type: RecurringTransaction['type']
  amountCents: number
  date: string
}

const MAX_ITERATIONS = 500

/**
 * Projects upcoming occurrences of a single recurring transaction within
 * [asOfISO, asOfISO + horizonDays], without persisting anything. Used to
 * render the Upcoming page and compute expected remaining balance.
 */
export function projectOccurrences(
  recurring: RecurringTransaction,
  asOfISO: string,
  horizonDays: number,
): ProjectedOccurrence[] {
  if (!recurring.isActive) return []

  const asOf = parseISODate(asOfISO)
  const horizonEnd = new Date(asOf)
  horizonEnd.setDate(horizonEnd.getDate() + horizonDays)
  const horizonEndISO = toISODate(horizonEnd)
  const endISO = recurring.endDate

  const occurrences: ProjectedOccurrence[] = []
  let cursor = recurring.nextRunDate
  let iterations = 0

  while (cursor <= horizonEndISO && iterations < MAX_ITERATIONS) {
    if (endISO && cursor > endISO) break
    occurrences.push({
      recurringId: recurring.id,
      name: recurring.name,
      accountId: recurring.accountId,
      categoryId: recurring.categoryId,
      type: recurring.type,
      amountCents: recurring.amountCents,
      date: cursor,
    })
    cursor = toISODate(advanceByFrequency(parseISODate(cursor), recurring.frequency))
    iterations += 1
  }

  return occurrences
}

export function projectAllOccurrences(
  recurring: RecurringTransaction[],
  asOfISO: string,
  horizonDays: number,
): ProjectedOccurrence[] {
  return recurring
    .flatMap((r) => projectOccurrences(r, asOfISO, horizonDays))
    .sort((a, b) => a.date.localeCompare(b.date))
}
