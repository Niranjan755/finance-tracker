import type { Currency } from '@/types'

/**
 * All money in this app is represented as integer cents. Never do currency
 * arithmetic with JavaScript floats - `addMoney`/`subtractMoney` operate on
 * integers so results are always exact.
 */
export type Cents = number

export const CURRENCIES: { code: Currency; symbol: string; locale: string; name: string }[] = [
  { code: 'USD', symbol: '$', locale: 'en-US', name: 'US Dollar' },
  { code: 'INR', symbol: '₹', locale: 'en-IN', name: 'Indian Rupee' },
  { code: 'EUR', symbol: '€', locale: 'de-DE', name: 'Euro' },
  { code: 'GBP', symbol: '£', locale: 'en-GB', name: 'British Pound' },
  { code: 'CAD', symbol: 'CA$', locale: 'en-CA', name: 'Canadian Dollar' },
  { code: 'AUD', symbol: 'A$', locale: 'en-AU', name: 'Australian Dollar' },
]

const LOCALE_BY_CURRENCY: Record<Currency, string> = Object.fromEntries(
  CURRENCIES.map((c) => [c.code, c.locale]),
) as Record<Currency, string>

/**
 * Converts a decimal amount to integer cents.
 *
 * String input (the common case: form fields, CSV cells) is parsed digit by
 * digit with no floating-point arithmetic at all, so "10.25" always yields
 * exactly 1025. Number input goes through an epsilon-corrected round, which
 * covers the rare programmatic caller passing a float directly.
 */
export function toCents(input: number | string): Cents {
  if (typeof input === 'string') {
    return parseCentsFromString(input)
  }
  if (!Number.isFinite(input)) {
    throw new Error(`Invalid money amount: ${input}`)
  }
  return Math.round((input + Number.EPSILON) * 100)
}

function parseCentsFromString(raw: string): Cents {
  const str = raw.trim().replace(/,/g, '')
  if (str === '' || Number.isNaN(Number(str))) {
    throw new Error(`Invalid money amount: "${raw}"`)
  }
  const negative = str.startsWith('-')
  const unsigned = negative ? str.slice(1) : str.startsWith('+') ? str.slice(1) : str
  const [wholeRaw = '', fracRaw = ''] = unsigned.split('.')
  const whole = wholeRaw === '' ? 0 : parseInt(wholeRaw, 10)
  const fracDigits = (fracRaw + '000').slice(0, 3)
  const fracCents = Math.round(parseInt(fracDigits, 10) / 10)
  const cents = whole * 100 + fracCents
  return negative ? -cents : cents
}

export function fromCents(cents: Cents): number {
  return cents / 100
}

/** Renders cents as a plain "12.34" string, suitable for a controlled number input. */
export function centsToInputValue(cents: Cents): string {
  return fromCents(cents).toFixed(2)
}

export function addMoney(...values: Cents[]): Cents {
  return values.reduce((sum, v) => sum + v, 0)
}

export function subtractMoney(a: Cents, b: Cents): Cents {
  return a - b
}

export function negateMoney(a: Cents): Cents {
  return -a
}

export function isPositive(cents: Cents): boolean {
  return cents > 0
}

export function formatCurrency(cents: Cents, currency: Currency = 'USD'): string {
  const locale = LOCALE_BY_CURRENCY[currency] ?? 'en-US'
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(fromCents(cents))
}

/** Formats with an explicit leading sign for expense (-) / income (+) / neutral transfer amounts. */
export function formatSignedCurrency(
  cents: Cents,
  kind: 'expense' | 'income' | 'neutral',
  currency: Currency = 'USD',
): string {
  const sign = kind === 'expense' ? '-' : kind === 'income' ? '+' : ''
  return `${sign}${formatCurrency(Math.abs(cents), currency)}`
}

/** Percentage of `part` within `whole`, rounded to one decimal place. Returns 0 when whole is 0. */
export function percentOf(part: Cents, whole: Cents): number {
  if (whole === 0) return 0
  return Math.round((part / whole) * 1000) / 10
}
