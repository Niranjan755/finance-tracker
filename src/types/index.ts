export type Currency = 'USD' | 'INR' | 'EUR' | 'GBP' | 'CAD' | 'AUD'

export type AccountType =
  'checking' | 'savings' | 'cash' | 'debit_card' | 'credit_card' | 'investment' | 'other'

/** Account types whose balance is a liability (owed money), not an asset. */
export const LIABILITY_ACCOUNT_TYPES: readonly AccountType[] = ['credit_card']

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
}
