import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { CategorySelector } from '@/features/transactions/CategorySelector'
import {
  FREQUENCY_LABELS,
  RECURRENCE_FREQUENCIES,
  recurringFormSchema,
  type RecurringFormValues,
} from '@/lib/validation/recurring'
import { centsToInputValue, toCents } from '@/lib/money'
import { todayISODate } from '@/lib/date'
import type { Account, Category, RecurringTransaction } from '@/types'
import type { RecurringInput } from '@/lib/finance/recurringOps'

interface RecurringFormProps {
  accounts: Account[]
  categories: Category[]
  recurring?: RecurringTransaction
  onSubmit: (values: RecurringInput) => Promise<void>
  onCancel: () => void
}

export function RecurringForm({ accounts, categories, recurring, onSubmit, onCancel }: RecurringFormProps) {
  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<RecurringFormValues>({
    resolver: zodResolver(recurringFormSchema),
    defaultValues: {
      name: recurring?.name ?? '',
      accountId: recurring?.accountId ?? accounts[0]?.id ?? '',
      categoryId: recurring?.categoryId ?? '',
      type: recurring?.type ?? 'expense',
      amount: recurring ? centsToInputValue(recurring.amountCents) : '',
      frequency: recurring?.frequency ?? 'monthly',
      startDate: recurring?.startDate ?? todayISODate(),
      endDate: recurring?.endDate ?? '',
    },
  })

  const type = watch('type')

  return (
    <form
      onSubmit={handleSubmit(async (values) => {
        await onSubmit({
          name: values.name,
          accountId: values.accountId,
          categoryId: values.categoryId,
          type: values.type,
          amountCents: toCents(values.amount),
          frequency: values.frequency,
          startDate: values.startDate,
          endDate: values.endDate || null,
        })
      })}
      className="space-y-5"
    >
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="rec-name">Name</FieldLabel>
          <Input id="rec-name" placeholder="Rent" {...register('name')} />
          <FieldError errors={[errors.name]} />
        </Field>

        <Controller
          name="type"
          control={control}
          render={({ field }) => (
            <Tabs value={field.value} onValueChange={field.onChange}>
              <TabsList className="w-full">
                <TabsTrigger value="expense" className="flex-1">
                  Expense
                </TabsTrigger>
                <TabsTrigger value="income" className="flex-1">
                  Income
                </TabsTrigger>
              </TabsList>
            </Tabs>
          )}
        />

        <div className="grid grid-cols-2 gap-4">
          <Field>
            <FieldLabel htmlFor="rec-amount">Amount</FieldLabel>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
              <Input id="rec-amount" inputMode="decimal" placeholder="0.00" className="pl-6" {...register('amount')} />
            </div>
            <FieldError errors={[errors.amount]} />
          </Field>
          <Field>
            <FieldLabel htmlFor="rec-frequency">Frequency</FieldLabel>
            <Controller
              name="frequency"
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={(v) => field.onChange(v ?? 'monthly')} items={FREQUENCY_LABELS}>
                  <SelectTrigger id="rec-frequency" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RECURRENCE_FREQUENCIES.map((f) => (
                      <SelectItem key={f} value={f}>
                        {FREQUENCY_LABELS[f]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
        </div>

        <Field>
          <FieldLabel htmlFor="rec-account">Account</FieldLabel>
          <Controller
            name="accountId"
            control={control}
            render={({ field }) => (
              <Select
                value={field.value}
                onValueChange={(v) => field.onChange(v ?? '')}
                items={Object.fromEntries(accounts.map((a) => [a.id, a.name]))}
              >
                <SelectTrigger id="rec-account" className="w-full">
                  <SelectValue placeholder="Choose an account" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          <FieldError errors={[errors.accountId]} />
        </Field>

        <Field>
          <FieldLabel htmlFor="rec-category">Category</FieldLabel>
          <Controller
            name="categoryId"
            control={control}
            render={({ field }) => (
              <CategorySelector id="rec-category" categories={categories} type={type} value={field.value} onChange={field.onChange} />
            )}
          />
          <FieldError errors={[errors.categoryId]} />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field>
            <FieldLabel htmlFor="rec-start">Start Date</FieldLabel>
            <Input id="rec-start" type="date" {...register('startDate')} />
            <FieldError errors={[errors.startDate]} />
          </Field>
          <Field>
            <FieldLabel htmlFor="rec-end">End Date (optional)</FieldLabel>
            <Input id="rec-end" type="date" {...register('endDate')} />
            <FieldError errors={[errors.endDate]} />
          </Field>
        </div>
      </FieldGroup>

      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {recurring ? 'Save Changes' : 'Add Recurring Transaction'}
        </Button>
      </div>
    </form>
  )
}
