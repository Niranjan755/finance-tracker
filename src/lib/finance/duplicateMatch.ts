import { differenceInCalendarDays } from 'date-fns'
import { parseISODate } from '@/lib/date'
import type { Transaction } from '@/types'

export interface DuplicateCandidate {
  type: Transaction['type']
  amountCents: number
  date: string
}

/**
 * Finds an existing manually-entered transaction (plaidTransactionId ===
 * null) that looks like the same real-world purchase as `candidate`: same
 * type/amount, dated within a day of each other (covers pending-vs-posted
 * date drift). Used to flag - never silently merge or delete - likely
 * duplicates when a Plaid sync pulls in transactions the user already
 * tracked by hand (e.g. they logged an account manually before linking it).
 */
export function findDuplicateManualTransaction(
  candidate: DuplicateCandidate,
  existingTransactions: Transaction[],
): Transaction | undefined {
  let best: Transaction | undefined
  let bestDiff = Infinity
  for (const t of existingTransactions) {
    if (t.plaidTransactionId !== null) continue
    if (t.type !== candidate.type || t.amountCents !== candidate.amountCents) continue
    const diff = Math.abs(
      differenceInCalendarDays(parseISODate(candidate.date), parseISODate(t.date)),
    )
    if (diff <= 1 && diff < bestDiff) {
      best = t
      bestDiff = diff
    }
  }
  return best
}
