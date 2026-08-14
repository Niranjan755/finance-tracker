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
import { useEffect } from 'react'

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
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<TransferFormValues>({
    resolver: zodResolver(transferFormSchema),
    defaultValues: {
      fromAccountId: transfer?.fromAccountId ?? '',
      toAccountId: transfer?.toAccountId ?? '',
      fromAmount: transfer ? centsToInputValue(transfer.fromAmountCents) : '',
      toAmount: transfer ? centsToInputValue(transfer.toAmountCents) : '',
      exchangeRate: transfer ? String(transfer.exchangeRate) : '1',
      date: transfer?.date ?? todayISODate(),
      description: transfer?.description ?? '',
    },
  })

  const fromAccountId = watch('fromAccountId')
  const toAccountId = watch('toAccountId')
  const fromAmount = watch('fromAmount')
  const toAmount = watch('toAmount')
  const exchangeRate = watch('exchangeRate')

  const fromAccount = accounts.find((a) => a.id === fromAccountId)
  const toAccount = accounts.find((a) => a.id === toAccountId)

  // Auto-calculate toAmount when fromAmount or exchangeRate changes
  useEffect(() => {
    if (fromAmount && exchangeRate) {
      const calculatedTo = (parseFloat(fromAmount.replace(/,/g, '')) * parseFloat(exchangeRate)).toFixed(2)
      if (calculatedTo !== toAmount.replace(/,/g, '')) {
        setValue('toAmount', calculatedTo)
      }
    }
  }, [fromAmount, exchangeRate, toAmount, setValue])

  return (
    <form
      onSubmit={handleSubmit(async (values) => {
        const fromAmountCents = toCents(values.fromAmount)
        const toAmountCents = toCents(values.toAmount)
        const rate = parseFloat(values.exchangeRate)

        await onSubmit({
          fromAccountId: values.fromAccountId,
          toAccountId: values.toAccountId,
          fromAmountCents,
          toAmountCents,
          exchangeRate: rate,
          date: values.date,
          description: values.description,
          isCreditCardPayment: toAccount?.type === 'credit_card',
        })
      })}
      className="space-y-5"
    >
      <FieldGroup>
        <Field>
          <FieldLabel>From Account</FieldLabel>
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

        <Field>
          <FieldLabel htmlFor="from-amount">
            Send Amount {fromAccount && `(${fromAccount.currency})`}
          </FieldLabel>
          <div className="relative">
            <span className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 -translate-y-1/2">
              {fromAccount?.currency === 'USD' && '$'}
              {fromAccount?.currency === 'INR' && '₹'}
              {fromAccount?.currency === 'EUR' && '€'}
              {fromAccount?.currency === 'GBP' && '£'}
            </span>
            <Input
              id="from-amount"
              inputMode="decimal"
              placeholder="0.00"
              className="pl-6 text-lg font-medium"
              {...register('fromAmount')}
            />
          </div>
          <FieldError errors={[errors.fromAmount]} />
        </Field>

        <div className="text-muted-foreground flex justify-center" aria-hidden="true">
          <ArrowDown className="size-4" />
        </div>

        <Field>
          <FieldLabel>To Account</FieldLabel>
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

        <Field>
          <FieldLabel htmlFor="to-amount">
            Receive Amount {toAccount && `(${toAccount.currency})`}
          </FieldLabel>
          <div className="relative">
            <span className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 -translate-y-1/2">
              {toAccount?.currency === 'USD' && '$'}
              {toAccount?.currency === 'INR' && '₹'}
              {toAccount?.currency === 'EUR' && '€'}
              {toAccount?.currency === 'GBP' && '£'}
            </span>
            <Input
              id="to-amount"
              inputMode="decimal"
              placeholder="0.00"
              className="pl-6 text-lg font-medium"
              {...register('toAmount')}
            />
          </div>
          <FieldError errors={[errors.toAmount]} />
        </Field>

        {/* Exchange Rate Field */}
        {fromAccount && toAccount && fromAccount.currency !== toAccount.currency && (
          <Field>
            <FieldLabel htmlFor="exchange-rate">
              Exchange Rate ({fromAccount.currency} to {toAccount.currency})
            </FieldLabel>
            <p className="text-muted-foreground mb-2 text-sm">
              1 {fromAccount.currency} = ? {toAccount.currency}
            </p>
            <Input
              id="exchange-rate"
              inputMode="decimal"
              placeholder="1.0"
              {...register('exchangeRate')}
            />
            <FieldError errors={[errors.exchangeRate]} />
          </Field>
        )}

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
              placeholder="e.g., Wire to India"
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
