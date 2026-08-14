import { z } from 'zod'

function isValidAmountString(v: string): boolean {
  return (
    v.trim() !== '' && !Number.isNaN(Number(v.replace(/,/g, ''))) && Number(v.replace(/,/g, '')) > 0
  )
}

export const budgetFormSchema = z.object({
  categoryId: z.string().min(1, 'Choose a category'),
  amount: z
    .string()
    .trim()
    .min(1, 'Amount is required')
    .refine(isValidAmountString, 'Enter a valid positive amount'),
})

export type BudgetFormValues = z.infer<typeof budgetFormSchema>
