export type Currency = 'USD' | 'INR' | 'EUR' | 'GBP' | 'CAD' | 'AUD'

export type AccountType =
  | 'checking'
  | 'savings'
  | 'cash'
  | 'debit_card'
  | 'credit_card'
  | 'investment'
  | 'loan'
  | 'other'

/** Account types whose balance is a liability (owed money), not an asset. */
export const LIABILITY_ACCOUNT_TYPES: readonly AccountType[] = ['credit_card', 'loan']

export interface Account {
  id: string
  name: string
  institution: string
  type: AccountType
  lastFour: string
  /** Always non-negative magnitude in integer cents. For assets this is money held;
   *  for liabilities (credit cards) this is the amount owed. */
  balanceCents: number
  creditLimitCents: number | null
  /** Credit cards only: the balance from the most recent statement. */
  statementBalanceCents: number | null
  /** Credit cards only: the minimum payment due. */
  minimumPaymentCents: number | null
  /** Credit cards only: ISO date the next payment is due. */
  paymentDueDate: string | null
  currency: Currency
  icon: string
  color: string
  isActive: boolean
  notes: string
  /** Set when this account is linked to a real bank via Plaid; balance and transactions sync automatically and become read-only. */
  plaidAccountId: string | null
  /** The Plaid Item (bank connection) this account belongs to - used to unlink all accounts from one bank at once. */
  plaidItemId: string | null
  createdAt: string
  updatedAt: string
}

export type CategoryType = 'expense' | 'income'

export interface Category {
  id: string
  name: string
  type: CategoryType
  parentId: string | null
  icon: string
  color: string
  isDefault: boolean
}

export type TransactionType = 'expense' | 'income'

export interface Transaction {
  id: string
  accountId: string
  categoryId: string
  type: TransactionType
  /** Always positive magnitude in integer cents. */
  amountCents: number
  merchant: string
  description: string
  /** ISO date string, YYYY-MM-DD. */
  date: string
  notes: string
  tags: string[]
  location: string
  receiptId: string | null
  recurringId: string | null
  /** Set when this transaction was imported from Plaid - used for sync idempotency and to mark it read-only in the UI. */
  plaidTransactionId: string | null
  /** Set when a Plaid sync finds an existing manual transaction that looks like the same
   *  real-world purchase (same type/amount, date within a day). Points at that manual
   *  transaction's id so the UI can offer to resolve the duplicate; never auto-resolved. */
  possibleDuplicateOfId: string | null
  createdAt: string
  updatedAt: string
}

export interface Transfer {
  id: string
  fromAccountId: string
  toAccountId: string
  /** Amount debited from source account in its currency (integer cents). */
  fromAmountCents: number
  /** Amount credited to destination account in its currency (integer cents). */
  toAmountCents: number
  /** Exchange rate applied (toAmount / fromAmount). Only used for cross-currency transfers. */
  exchangeRate: number
  date: string
  description: string
  /** True when this transfer represents paying down a credit card balance. */
  isCreditCardPayment: boolean
  createdAt: string
}

export type RecurrenceFrequency =
  'daily' | 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly'

export interface RecurringTransaction {
  id: string
  name: string
  accountId: string
  categoryId: string
  type: TransactionType
  amountCents: number
  frequency: RecurrenceFrequency
  startDate: string
  endDate: string | null
  nextRunDate: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface Budget {
  id: string
  categoryId: string
  /** 1-12 */
  month: number
  year: number
  amountCents: number
  /** When true, unused amount from this budget rolls forward into next month's
   *  budget for the same category (if that budget also has this enabled). */
  rolloverEnabled: boolean
}

export interface Receipt {
  id: string
  transactionId: string
  fileName: string
  mimeType: string
  blob: Blob
  createdAt: string
}

export type ThemePreference = 'light' | 'dark' | 'system'

export interface NotificationPreferences {
  upcomingPayments: boolean
  budgetAlerts: boolean
  recurringTransactions: boolean
  monthlyReports: boolean
}

export interface Settings {
  id: 'app'
  currency: Currency
  dateFormat: string
  startOfWeek: 0 | 1
  theme: ThemePreference
  notifications: NotificationPreferences
  onboardingComplete: boolean
  userName: string
  /** When true, due recurring transactions are posted automatically on app load.
   *  When false (default), they only appear as projected "Upcoming" items until
   *  the user explicitly records them. */
  autoGenerateRecurring: boolean
  /** YYYY-MM of the last month a monthly report toast was shown for, so it only shows once. */
  lastMonthlyReportMonth: string
  /** Whether the user has opted into real browser push notifications (separate from the
   *  in-app notification categories above, since this one gates the OS permission/subscription). */
  pushEnabled: boolean
}

export const DEFAULT_SETTINGS: Settings = {
  id: 'app',
  currency: 'USD',
  dateFormat: 'MMM d, yyyy',
  startOfWeek: 0,
  theme: 'system',
  notifications: {
    upcomingPayments: true,
    budgetAlerts: true,
    recurringTransactions: true,
    monthlyReports: true,
  },
  onboardingComplete: false,
  userName: '',
  autoGenerateRecurring: false,
  lastMonthlyReportMonth: '',
  pushEnabled: false,
}
