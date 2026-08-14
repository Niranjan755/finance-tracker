import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { budgetFormSchema, type BudgetFormValues } from '@/lib/validation/budget'
import { centsToInputValue, toCents } from '@/lib/money'
import type { Budget, Category } from '@/types'

interface BudgetFormProps {
  categories: Category[]
  budget?: Budget
  usedCategoryIds: string[]
  onSubmit: (values: { categoryId: string; amountCents: number }) => Promise<void>
  onCancel: () => void
}

export function BudgetForm({ categories, budget, usedCategoryIds, onSubmit, onCancel }: BudgetFormProps) {
  const expenseCategories = categories.filter((c) => c.type === 'expense')
  const availableCategories = expenseCategories.filter((c) => c.id === budget?.categoryId || !usedCategoryIds.includes(c.id))

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<BudgetFormValues>({
    resolver: zodResolver(budgetFormSchema),
    defaultValues: {
      categoryId: budget?.categoryId ?? '',
      amount: budget ? centsToInputValue(budget.amountCents) : '',
    },
  })

  return (
    <form
      onSubmit={handleSubmit(async (values) => {
        await onSubmit({ categoryId: values.categoryId, amountCents: toCents(values.amount) })
      })}
      className="space-y-5"
    >
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="budget-category">Category</FieldLabel>
          <Controller
            name="categoryId"
            control={control}
            render={({ field }) => (
              <Select
                value={field.value}
                onValueChange={(v) => field.onChange(v ?? '')}
                disabled={!!budget}
                items={Object.fromEntries(availableCategories.map((c) => [c.id, c.name]))}
              >
                <SelectTrigger id="budget-category" className="w-full">
                  <SelectValue placeholder="Choose a category" />
                </SelectTrigger>
                <SelectContent>
                  {availableCategories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.parentId ? `  ${c.name}` : c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          <FieldError errors={[errors.categoryId]} />
        </Field>

        <Field>
          <FieldLabel htmlFor="budget-amount">Monthly Budget</FieldLabel>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
            <Input id="budget-amount" inputMode="decimal" placeholder="0.00" className="pl-6" {...register('amount')} />
          </div>
          <FieldError errors={[errors.amount]} />
        </Field>
      </FieldGroup>

      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {budget ? 'Save Changes' : 'Create Budget'}
        </Button>
      </div>
    </form>
  )
}
