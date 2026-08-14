import {
  addDays,
  addMonths,
  addQuarters,
  addWeeks,
  addYears,
  endOfMonth,
  format,
  formatISO,
  isAfter,
  isBefore,
  isValid,
  parseISO,
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

/** Advances a date by one occurrence of the given recurrence frequency. */
export function advanceByFrequency(date: Date, frequency: RecurrenceFrequency): Date {
  switch (frequency) {
    case 'daily':
      return addDays(date, 1)
    case 'weekly':
      return addWeeks(date, 1)
    case 'biweekly':
      return addWeeks(date, 2)
    case 'monthly':
      return addMonths(date, 1)
    case 'quarterly':
      return addQuarters(date, 1)
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
