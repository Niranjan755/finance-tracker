import { z } from 'zod'
import { CURRENCIES } from '@/lib/money'
import type { Currency } from '@/types'

export const ACCOUNT_TYPES = [
  'checking',
  'savings',
  'cash',
  'debit_card',
  'credit_card',
  'investment',
  'other',
] as const

export const ACCOUNT_TYPE_LABELS: Record<(typeof ACCOUNT_TYPES)[number], string> = {
  checking: 'Checking',
  savings: 'Savings',
  cash: 'Cash',
  debit_card: 'Debit Card',
  credit_card: 'Credit Card',
  investment: 'Investment',
  other: 'Other',
}

const CURRENCY_CODES = CURRENCIES.map((c) => c.code) as [Currency, ...Currency[]]

function isValidAmountString(v: string): boolean {
  return v.trim() !== '' && !Number.isNaN(Number(v.replace(/,/g, '')))
}

export const accountFormSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, 'Account name is required')
      .max(60, 'Keep it under 60 characters'),
    institution: z.string().trim().max(60, 'Keep it under 60 characters'),
    type: z.enum(ACCOUNT_TYPES),
    lastFour: z
      .string()
      .trim()
      .regex(/^\d{0,4}$/, 'Enter up to 4 digits'),
    startingBalance: z
      .string()
      .trim()
      .min(1, 'Starting balance is required')
      .refine(isValidAmountString, 'Enter a valid amount'),
    creditLimit: z.string().trim(),
    statementBalance: z.string().trim(),
    minimumPayment: z.string().trim(),
    paymentDueDate: z.string().trim(),
    currency: z.enum(CURRENCY_CODES),
    icon: z.string().min(1),
    color: z.string().min(1),
    notes: z.string().trim().max(500, 'Keep notes under 500 characters'),
  })
  .superRefine((data, ctx) => {
    if (data.type === 'credit_card') {
      if (
        !isValidAmountString(data.creditLimit) ||
        Number(data.creditLimit.replace(/,/g, '')) <= 0
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['creditLimit'],
          message: 'Credit limit is required for credit cards',
        })
      }
    }
  })

export type AccountFormValues = z.infer<typeof accountFormSchema>
