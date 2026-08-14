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
  const text = signed ? formatSignedCurrency(cents, kind, currency) : formatCurrency(Math.abs(cents), currency)
  return <span className={cn('tabular-nums', KIND_CLASS[kind], className)}>{text}</span>
}
