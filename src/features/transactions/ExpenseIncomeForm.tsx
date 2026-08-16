import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { AccountSelector } from './AccountSelector'
import { CategorySelector } from './CategorySelector'
import {
  parseTagsInput,
  tagsToInputString,
  transactionFormSchema,
  type TransactionFormValues,
} from '@/lib/validation/transaction'
import { centsToInputValue, CURRENCIES, toCents } from '@/lib/money'
import { todayISODate } from '@/lib/date'
import { suggestCategoryForMerchant } from '@/lib/finance/calculations'
import { useFinanceStore } from '@/store/financeStore'
import type { Account, Category, Transaction, TransactionType } from '@/types'
import type { TransactionFormInput } from '@/store/financeStore'

interface ExpenseIncomeFormProps {
  type: TransactionType
  accounts: Account[]
  categories: Category[]
  defaultAccountId?: string | null
  transaction?: Transaction
  onSubmit: (values: TransactionFormInput) => Promise<void>
  onCancel: () => void
}

export function ExpenseIncomeForm({
  type,
  accounts,
  categories,
  defaultAccountId,
  transaction,
  onSubmit,
  onCancel,
}: ExpenseIncomeFormProps) {
  const transactions = useFinanceStore((s) => s.transactions)
  const {
    register,
    handleSubmit,
    control,
    watch,
    getValues,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<TransactionFormValues>({
    resolver: zodResolver(transactionFormSchema),
    defaultValues: {
      accountId: transaction?.accountId ?? defaultAccountId ?? accounts[0]?.id ?? '',
      categoryId: transaction?.categoryId ?? '',
      amount: transaction ? centsToInputValue(transaction.amountCents) : '',
      date: transaction?.date ?? todayISODate(),
      merchant: transaction?.merchant ?? '',
      description: transaction?.description ?? '',
      notes: transaction?.notes ?? '',
      tags: transaction ? tagsToInputString(transaction.tags) : '',
      location: transaction?.location ?? '',
    },
  })

  const amountLabel = type === 'expense' ? 'Amount' : 'Amount'
  const selectedAccountId = watch('accountId')
  const selectedAccountCurrency = accounts.find((a) => a.id === selectedAccountId)?.currency
  const currencySymbol = CURRENCIES.find((c) => c.code === selectedAccountCurrency)?.symbol ?? '$'

  function handleMerchantBlur() {
    if (transaction || getValues('categoryId')) return
    const suggestion = suggestCategoryForMerchant(getValues('merchant'), type, transactions)
    if (suggestion) setValue('categoryId', suggestion, { shouldValidate: true })
  }

  return (
    <form
      onSubmit={handleSubmit(async (values) => {
        await onSubmit({
          accountId: values.accountId,
          categoryId: values.categoryId,
          type,
          amountCents: toCents(values.amount),
          date: values.date,
          merchant: values.merchant,
          description: values.description,
          notes: values.notes,
          tags: parseTagsInput(values.tags),
          location: values.location,
        })
      })}
      className="space-y-5"
    >
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor={`${type}-amount`}>{amountLabel}</FieldLabel>
          <div className="relative">
            <span className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 -translate-y-1/2">
              {currencySymbol}
            </span>
            <Input
              id={`${type}-amount`}
              inputMode="decimal"
              placeholder="0.00"
              className="pl-6 text-lg font-medium"
              autoFocus
              {...register('amount')}
            />
          </div>
          <FieldError errors={[errors.amount]} />
        </Field>

        <Field>
          <FieldLabel>{type === 'expense' ? 'Paid With' : 'Received Into'}</FieldLabel>
          <Controller
            name="accountId"
            control={control}
            render={({ field }) => (
              <AccountSelector
                accounts={accounts}
                value={field.value}
                onChange={field.onChange}
                label={type === 'expense' ? 'Paid with' : 'Received into'}
              />
            )}
          />
          <FieldError errors={[errors.accountId]} />
        </Field>

        <Field>
          <FieldLabel htmlFor={`${type}-category`}>Category</FieldLabel>
          <Controller
            name="categoryId"
            control={control}
            render={({ field }) => (
              <CategorySelector
                id={`${type}-category`}
                categories={categories}
                type={type}
                value={field.value}
                onChange={field.onChange}
              />
            )}
          />
          <FieldError errors={[errors.categoryId]} />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field>
            <FieldLabel htmlFor={`${type}-merchant`}>
              {type === 'expense' ? 'Merchant' : 'Source'}
            </FieldLabel>
            <Input
              id={`${type}-merchant`}
              placeholder={type === 'expense' ? 'Olive Garden' : 'Employer name'}
              {...register('merchant', { onBlur: handleMerchantBlur })}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor={`${type}-date`}>Date</FieldLabel>
            <Input id={`${type}-date`} type="date" {...register('date')} />
            <FieldError errors={[errors.date]} />
          </Field>
        </div>

        <Field>
          <FieldLabel htmlFor={`${type}-tags`}>Tags (optional, comma separated)</FieldLabel>
          <Input id={`${type}-tags`} placeholder="travel, work" {...register('tags')} />
        </Field>

        <Field>
          <FieldLabel htmlFor={`${type}-notes`}>Notes (optional)</FieldLabel>
          <Textarea id={`${type}-notes`} rows={2} placeholder="Add a note" {...register('notes')} />
          <FieldError errors={[errors.notes]} />
        </Field>
      </FieldGroup>

      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {transaction ? 'Save Changes' : type === 'expense' ? 'Save Expense' : 'Save Income'}
        </Button>
      </div>
    </form>
  )
}
