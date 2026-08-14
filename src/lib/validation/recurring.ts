import { z } from 'zod'

function isValidAmountString(v: string): boolean {
  return (
    v.trim() !== '' && !Number.isNaN(Number(v.replace(/,/g, ''))) && Number(v.replace(/,/g, '')) > 0
  )
}

export const RECURRENCE_FREQUENCIES = [
  'daily',
  'weekly',
  'biweekly',
  'monthly',
  'quarterly',
  'yearly',
] as const

export const FREQUENCY_LABELS: Record<(typeof RECURRENCE_FREQUENCIES)[number], string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  biweekly: 'Every 2 Weeks',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  yearly: 'Yearly',
}

export const recurringFormSchema = z
  .object({
    name: z.string().trim().min(1, 'Name is required').max(80, 'Keep it under 80 characters'),
    accountId: z.string().min(1, 'Choose an account'),
    categoryId: z.string().min(1, 'Choose a category'),
    type: z.enum(['expense', 'income']),
    amount: z
      .string()
      .trim()
      .min(1, 'Amount is required')
      .refine(isValidAmountString, 'Enter a valid positive amount'),
    frequency: z.enum(RECURRENCE_FREQUENCIES),
    startDate: z.string().min(1, 'Start date is required'),
    endDate: z.string(),
  })
  .refine((data) => !data.endDate || data.endDate >= data.startDate, {
    message: 'End date must be after the start date',
    path: ['endDate'],
  })

export type RecurringFormValues = z.infer<typeof recurringFormSchema>
