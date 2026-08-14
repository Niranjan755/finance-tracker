import { z } from 'zod'

function isValidAmountString(v: string): boolean {
  return v.trim() !== '' && !Number.isNaN(Number(v.replace(/,/g, ''))) && Number(v.replace(/,/g, '')) > 0
}

export const transactionFormSchema = z.object({
  accountId: z.string().min(1, 'Choose an account'),
  categoryId: z.string().min(1, 'Choose a category'),
  amount: z.string().trim().min(1, 'Amount is required').refine(isValidAmountString, 'Enter a valid positive amount'),
  date: z.string().min(1, 'Date is required'),
  merchant: z.string().trim().max(80, 'Keep it under 80 characters'),
  description: z.string().trim().max(200, 'Keep it under 200 characters'),
  notes: z.string().trim().max(500, 'Keep notes under 500 characters'),
  tags: z.string().trim().max(200, 'Keep tags under 200 characters'),
  location: z.string().trim().max(120, 'Keep it under 120 characters'),
})

export type TransactionFormValues = z.infer<typeof transactionFormSchema>

export const transferFormSchema = z
  .object({
    fromAccountId: z.string().min(1, 'Choose a source account'),
    toAccountId: z.string().min(1, 'Choose a destination account'),
    amount: z.string().trim().min(1, 'Amount is required').refine(isValidAmountString, 'Enter a valid positive amount'),
    date: z.string().min(1, 'Date is required'),
    description: z.string().trim().max(200, 'Keep it under 200 characters'),
  })
  .refine((data) => data.fromAccountId !== data.toAccountId, {
    message: 'Source and destination accounts must be different',
    path: ['toAccountId'],
  })

export type TransferFormValues = z.infer<typeof transferFormSchema>

export function parseTagsInput(tagsString: string): string[] {
  return tagsString
    .split(',')
    .map((t) => t.trim().replace(/^#/, ''))
    .filter(Boolean)
}

export function tagsToInputString(tags: string[]): string {
  return tags.join(', ')
}
