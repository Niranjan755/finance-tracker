import { LIABILITY_ACCOUNT_TYPES, type AccountType } from '@/types'
import type { Cents } from '@/lib/money'

export function isLiabilityAccountType(type: AccountType): boolean {
  return (LIABILITY_ACCOUNT_TYPES as AccountType[]).includes(type)
}

/**
 * The balance delta for money leaving an account (an expense, or the "from"
 * side of a transfer). For asset accounts this is negative (balance drops);
 * for liability accounts (credit cards) it's positive (debt grows).
 */
export function debitDelta(accountType: AccountType, amountCents: Cents): Cents {
  return isLiabilityAccountType(accountType) ? amountCents : -amountCents
}

/**
 * The balance delta for money arriving in an account (income, or the "to"
 * side of a transfer). For asset accounts this is positive; for liability
 * accounts it's negative - which is exactly correct for a credit card
 * payment: the "to" account is the card, and the payment reduces its debt.
 */
export function creditDelta(accountType: AccountType, amountCents: Cents): Cents {
  return isLiabilityAccountType(accountType) ? -amountCents : amountCents
}

export function assertPositiveAmount(amountCents: Cents): void {
  if (!Number.isInteger(amountCents) || amountCents <= 0) {
    throw new Error('Amount must be a positive value')
  }
}

/** Available credit for a credit card: limit minus the amount currently owed. Never negative. */
export function availableCredit(creditLimitCents: Cents, balanceCents: Cents): Cents {
  return Math.max(0, creditLimitCents - balanceCents)
}

/** Credit utilization as a percentage (0-100+), rounded to one decimal. */
export function creditUtilization(creditLimitCents: Cents, balanceCents: Cents): number {
  if (creditLimitCents <= 0) return 0
  return Math.round((balanceCents / creditLimitCents) * 1000) / 10
}
