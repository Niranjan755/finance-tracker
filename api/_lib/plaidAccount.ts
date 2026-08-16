import type { AccountBase } from 'plaid'
import type { Account, AccountType } from '../../src/types'

export function mapAccountType(plaidType: string, plaidSubtype: string | null): AccountType {
  if (plaidType === 'credit') return 'credit_card'
  if (plaidType === 'loan') return 'loan'
  if (plaidType === 'investment') return 'investment'
  if (plaidType === 'depository') return plaidSubtype === 'savings' ? 'savings' : 'checking'
  return 'other'
}

export function isLiabilityType(type: AccountType): boolean {
  return type === 'credit_card' || type === 'loan'
}

/** Builds a fresh local Account from a Plaid account, used the first time an account is linked. */
export function toAppAccount(
  plaidAccount: AccountBase,
  itemId: string,
  institutionName: string | null,
  now: string,
): Account {
  const type = mapAccountType(plaidAccount.type, plaidAccount.subtype ?? null)
  const isLiability = isLiabilityType(type)
  const balanceCents = Math.abs(Math.round((plaidAccount.balances.current ?? 0) * 100))

  return {
    id: `plaid_${plaidAccount.account_id}`,
    name: plaidAccount.name,
    institution: institutionName ?? '',
    type,
    lastFour: plaidAccount.mask ?? '',
    balanceCents,
    creditLimitCents:
      isLiability && plaidAccount.balances.limit != null
        ? Math.round(plaidAccount.balances.limit * 100)
        : null,
    statementBalanceCents: null,
    minimumPaymentCents: null,
    paymentDueDate: null,
    currency: (plaidAccount.balances.iso_currency_code as Account['currency']) ?? 'USD',
    icon: type === 'credit_card' ? 'credit-card' : type === 'loan' ? 'landmark' : 'landmark',
    color: '#2a78d6',
    isActive: true,
    notes: '',
    plaidAccountId: plaidAccount.account_id,
    plaidItemId: itemId,
    createdAt: now,
    updatedAt: now,
  }
}

/** Refreshes an already-linked local Account's balance from Plaid's current numbers. */
export function refreshAppAccount(existing: Account, plaidAccount: AccountBase): Account {
  const type = mapAccountType(plaidAccount.type, plaidAccount.subtype ?? null)
  const isLiability = isLiabilityType(type)
  const balanceCents = Math.abs(Math.round((plaidAccount.balances.current ?? 0) * 100))
  return {
    ...existing,
    balanceCents,
    creditLimitCents:
      isLiability && plaidAccount.balances.limit != null
        ? Math.round(plaidAccount.balances.limit * 100)
        : existing.creditLimitCents,
    updatedAt: new Date().toISOString(),
  }
}
