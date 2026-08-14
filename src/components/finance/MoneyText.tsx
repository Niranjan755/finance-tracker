import { formatCurrency, formatSignedCurrency } from '@/lib/money'
import { cn } from '@/lib/utils'
import type { Currency } from '@/types'

type Kind = 'expense' | 'income' | 'neutral'

const KIND_CLASS: Record<Kind, string> = {
  expense: 'text-red-600 dark:text-red-400',
  income: 'text-emerald-600 dark:text-emerald-400',
  neutral: 'text-foreground',
}

interface MoneyTextProps {
  cents: number
  kind?: Kind
  currency?: Currency
  signed?: boolean
  className?: string
}

/** Renders an amount with color AND an explicit sign, so meaning never depends on color alone. */
export function MoneyText({ cents, kind = 'neutral', currency = 'USD', signed = true, className }: MoneyTextProps) {
  // signed=false means "no forced leading +/-", not "hide a real negative" - formatCurrency
  // already renders negative amounts with a minus sign, so never Math.abs() here.
  const text = signed ? formatSignedCurrency(cents, kind, currency) : formatCurrency(cents, currency)
  const effectiveKind = kind === 'neutral' && cents < 0 ? 'expense' : kind
  return <span className={cn('tabular-nums', KIND_CLASS[effectiveKind], className)}>{text}</span>
}
