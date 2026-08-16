import {
  addDays,
  addMonths,
  addQuarters,
  addWeeks,
  addYears,
  endOfMonth,
  format,
  formatISO,
  getDate,
  isAfter,
  isBefore,
  isValid,
  parseISO,
  setDate,
  startOfMonth,
  subMonths,
} from 'date-fns'
import type { RecurrenceFrequency } from '@/types'

/** YYYY-MM-DD in local time - the canonical date representation used across the app. */
export function toISODate(date: Date): string {
  return formatISO(date, { representation: 'date' })
}

export function todayISODate(): string {
  return toISODate(new Date())
}

export function parseISODate(iso: string): Date {
  const date = parseISO(iso)
  if (!isValid(date)) {
    throw new Error(`Invalid ISO date: "${iso}"`)
  }
  return date
}

export function formatDisplayDate(iso: string, pattern = 'MMM d, yyyy'): string {
  return format(parseISODate(iso), pattern)
}

export function monthKey(iso: string): string {
  return iso.slice(0, 7) // "YYYY-MM"
}

export interface MonthBounds {
  year: number
  month: number // 1-12
  startISO: string
  endISO: string
  label: string
}

export function getMonthBounds(year: number, month: number): MonthBounds {
  const anchor = new Date(year, month - 1, 1)
  return {
    year,
    month,
    startISO: toISODate(startOfMonth(anchor)),
    endISO: toISODate(endOfMonth(anchor)),
    label: format(anchor, 'MMMM yyyy'),
  }
}

export function monthBoundsFromISO(iso: string): MonthBounds {
  const date = parseISODate(iso)
  return getMonthBounds(date.getFullYear(), date.getMonth() + 1)
}

/** Most recent `count` months, newest first, including the current month. */
export function listRecentMonths(count: number, from: Date = new Date()): MonthBounds[] {
  return Array.from({ length: count }, (_, i) => {
    const d = subMonths(from, i)
    return getMonthBounds(d.getFullYear(), d.getMonth() + 1)
  })
}

export function isDateInRange(iso: string, startISO: string, endISO: string): boolean {
  return iso >= startISO && iso <= endISO
}

/**
 * Advances a `date` by one month/quarter, then re-anchors the result to
 * `anchorDay` (clamped to the target month's length) instead of trusting
 * whatever day `date-fns` clamped to. Without this, a rule anchored on the
 * 31st permanently drifts downward the first time it crosses a shorter
 * month (Aug 31 -> Sep 30 -> Oct 30 -> ... never back to 31), because each
 * step re-clamps from the *previous* occurrence rather than the original
 * start date.
 */
function anchoredMonthAdvance(date: Date, months: number, anchorDay: number): Date {
  const advanced = addMonths(date, months)
  const lastDayOfTargetMonth = getDate(endOfMonth(advanced))
  return setDate(advanced, Math.min(anchorDay, lastDayOfTargetMonth))
}

/**
 * Advances a date by one occurrence of the given recurrence frequency.
 * `anchorDay` (typically the day-of-month of the rule's original start
 * date) keeps monthly/quarterly schedules from drifting after crossing a
 * shorter month - pass it whenever advancing a persisted recurring rule.
 */
export function advanceByFrequency(
  date: Date,
  frequency: RecurrenceFrequency,
  anchorDay?: number,
): Date {
  switch (frequency) {
    case 'daily':
      return addDays(date, 1)
    case 'weekly':
      return addWeeks(date, 1)
    case 'biweekly':
      return addWeeks(date, 2)
    case 'monthly':
      return anchorDay ? anchoredMonthAdvance(date, 1, anchorDay) : addMonths(date, 1)
    case 'quarterly':
      return anchorDay ? anchoredMonthAdvance(date, 3, anchorDay) : addQuarters(date, 1)
    case 'yearly':
      return addYears(date, 1)
  }
}

export function isDateBefore(a: string, b: string): boolean {
  return isBefore(parseISODate(a), parseISODate(b))
}

export function isDateAfter(a: string, b: string): boolean {
  return isAfter(parseISODate(a), parseISODate(b))
}
