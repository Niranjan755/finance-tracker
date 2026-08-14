import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowDown } from 'lucide-react'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { AccountSelector } from './AccountSelector'
import { transferFormSchema, type TransferFormValues } from '@/lib/validation/transaction'
import { centsToInputValue, toCents } from '@/lib/money'
import { todayISODate } from '@/lib/date'
import type { Account, Transfer } from '@/types'
import type { TransferFormInput } from '@/store/financeStore'

interface TransferFormProps {
  accounts: Account[]
  transfer?: Transfer
  onSubmit: (values: TransferFormInput) => Promise<void>
  onCancel: () => void
}

export function TransferForm({ accounts, transfer, onSubmit, onCancel }: TransferFormProps) {
  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<TransferFormValues>({
    resolver: zodResolver(transferFormSchema),
    defaultValues: {
      fromAccountId: transfer?.fromAccountId ?? '',
      toAccountId: transfer?.toAccountId ?? '',
      amount: transfer ? centsToInputValue(transfer.amountCents) : '',
      date: transfer?.date ?? todayISODate(),
      description: transfer?.description ?? '',
    },
  })

  const fromAccountId = watch('fromAccountId')
  const toAccountId = watch('toAccountId')
  const toAccount = accounts.find((a) => a.id === toAccountId)

  return (
    <form
      onSubmit={handleSubmit(async (values) => {
        await onSubmit({
          fromAccountId: values.fromAccountId,
          toAccountId: values.toAccountId,
          amountCents: toCents(values.amount),
          date: values.date,
          description: values.description,
          isCreditCardPayment: toAccount?.type === 'credit_card',
        })
      })}
      className="space-y-5"
    >
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="transfer-amount">Amount</FieldLabel>
          <div className="relative">
            <span className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 -translate-y-1/2">
              $
            </span>
            <Input
              id="transfer-amount"
              inputMode="decimal"
              placeholder="0.00"
              className="pl-6 text-lg font-medium"
              {...register('amount')}
            />
          </div>
          <FieldError errors={[errors.amount]} />
        </Field>

        <Field>
          <FieldLabel>From</FieldLabel>
          <Controller
            name="fromAccountId"
            control={control}
            render={({ field }) => (
              <AccountSelector
                accounts={accounts}
                value={field.value}
                onChange={field.onChange}
                label="From account"
                excludeAccountId={toAccountId}
              />
            )}
          />
          <FieldError errors={[errors.fromAccountId]} />
        </Field>

        <div className="text-muted-foreground flex justify-center" aria-hidden="true">
          <ArrowDown className="size-4" />
        </div>

        <Field>
          <FieldLabel>To</FieldLabel>
          <Controller
            name="toAccountId"
            control={control}
            render={({ field }) => (
              <AccountSelector
                accounts={accounts}
                value={field.value}
                onChange={field.onChange}
                label="To account"
                excludeAccountId={fromAccountId}
              />
            )}
          />
          <FieldError errors={[errors.toAccountId]} />
        </Field>

        {toAccount?.type === 'credit_card' && (
          <p className="bg-muted/40 text-muted-foreground rounded-lg border px-3 py-2 text-xs">
            This will be recorded as a credit card payment - it reduces the card's balance and won't
            count as spending.
          </p>
        )}

        <div className="grid grid-cols-2 gap-4">
          <Field>
            <FieldLabel htmlFor="transfer-date">Date</FieldLabel>
            <Input id="transfer-date" type="date" {...register('date')} />
            <FieldError errors={[errors.date]} />
          </Field>
          <Field>
            <FieldLabel htmlFor="transfer-description">Description (optional)</FieldLabel>
            <Input
              id="transfer-description"
              placeholder="Savings deposit"
              {...register('description')}
            />
          </Field>
        </div>
      </FieldGroup>

      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {transfer ? 'Save Changes' : 'Transfer Money'}
        </Button>
      </div>
    </form>
  )
}
