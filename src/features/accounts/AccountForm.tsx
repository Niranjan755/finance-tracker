import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { CURRENCIES, formatCurrency } from '@/lib/money'
import { ACCOUNT_COLOR_OPTIONS, ACCOUNT_ICON_OPTIONS, getIcon } from '@/lib/icons'
import { cn } from '@/lib/utils'
import {
  ACCOUNT_TYPES,
  ACCOUNT_TYPE_LABELS,
  accountFormSchema,
  type AccountFormValues,
} from '@/lib/validation/account'
import type { Account } from '@/types'

const CURRENCY_ITEMS = Object.fromEntries(CURRENCIES.map((c) => [c.code, `${c.code} - ${c.name}`]))

interface AccountFormProps {
  account?: Account
  onSubmit: (values: AccountFormValues) => Promise<void>
  onCancel: () => void
}

export function AccountForm({ account, onSubmit, onCancel }: AccountFormProps) {
  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<AccountFormValues>({
    resolver: zodResolver(accountFormSchema),
    defaultValues: {
      name: account?.name ?? '',
      institution: account?.institution ?? '',
      type: account?.type ?? 'checking',
      lastFour: account?.lastFour ?? '',
      startingBalance: account ? (account.balanceCents / 100).toFixed(2) : '',
      creditLimit: account?.creditLimitCents ? (account.creditLimitCents / 100).toFixed(2) : '',
      statementBalance: account?.statementBalanceCents
        ? (account.statementBalanceCents / 100).toFixed(2)
        : '',
      minimumPayment: account?.minimumPaymentCents
        ? (account.minimumPaymentCents / 100).toFixed(2)
        : '',
      paymentDueDate: account?.paymentDueDate ?? '',
      currency: account?.currency ?? 'USD',
      icon: account?.icon ?? 'landmark',
      color: account?.color ?? ACCOUNT_COLOR_OPTIONS[0],
      notes: account?.notes ?? '',
    },
  })

  const type = watch('type')
  const isCreditCard = type === 'credit_card'

  return (
    <form
      onSubmit={handleSubmit(async (values) => {
        await onSubmit(values)
      })}
      className="space-y-5"
    >
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="acct-name">Account Name</FieldLabel>
          <Input id="acct-name" placeholder="Chase Checking" {...register('name')} />
          <FieldError errors={[errors.name]} />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field>
            <FieldLabel htmlFor="acct-institution">Institution</FieldLabel>
            <Input id="acct-institution" placeholder="Chase" {...register('institution')} />
            <FieldError errors={[errors.institution]} />
          </Field>
          <Field>
            <FieldLabel htmlFor="acct-type">Account Type</FieldLabel>
            <Controller
              name="type"
              control={control}
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={field.onChange}
                  items={ACCOUNT_TYPE_LABELS}
                >
                  <SelectTrigger id="acct-type" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ACCOUNT_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {ACCOUNT_TYPE_LABELS[t]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field>
            <FieldLabel htmlFor="acct-lastfour">Last 4 Digits (optional)</FieldLabel>
            <Input
              id="acct-lastfour"
              placeholder="4821"
              maxLength={4}
              inputMode="numeric"
              {...register('lastFour')}
            />
            <FieldError errors={[errors.lastFour]} />
          </Field>
          <Field>
            <FieldLabel htmlFor="acct-currency">Currency</FieldLabel>
            <Controller
              name="currency"
              control={control}
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={field.onChange}
                  disabled={!!account}
                  items={CURRENCY_ITEMS}
                >
                  <SelectTrigger id="acct-currency" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((c) => (
                      <SelectItem key={c.code} value={c.code}>
                        {c.code} - {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {account && (
              <p className="text-muted-foreground text-xs">
                Currency can't be changed after an account is created — create a new account
                instead.
              </p>
            )}
          </Field>
        </div>

        {!account ? (
          <Field>
            <FieldLabel htmlFor="acct-balance">
              {isCreditCard ? 'Current Balance Owed' : 'Starting Balance'}
            </FieldLabel>
            <Input
              id="acct-balance"
              placeholder="0.00"
              inputMode="decimal"
              {...register('startingBalance')}
            />
            <FieldError errors={[errors.startingBalance]} />
          </Field>
        ) : (
          <div className="bg-muted/40 text-muted-foreground rounded-lg border px-3 py-2 text-sm">
            Current balance:{' '}
            <span className="text-foreground font-medium">
              {formatCurrency(account.balanceCents, account.currency)}
            </span>
            <span className="block text-xs">
              Balance only changes from transactions, transfers, and payments.
            </span>
          </div>
        )}

        {isCreditCard && (
          <Field>
            <FieldLabel htmlFor="acct-limit">Credit Limit</FieldLabel>
            <Input
              id="acct-limit"
              placeholder="5000"
              inputMode="decimal"
              {...register('creditLimit')}
            />
            <FieldError errors={[errors.creditLimit]} />
          </Field>
        )}

        {isCreditCard && account && (
          <div className="grid grid-cols-3 gap-4">
            <Field>
              <FieldLabel htmlFor="acct-statement">Statement Balance</FieldLabel>
              <Input
                id="acct-statement"
                placeholder="0.00"
                inputMode="decimal"
                {...register('statementBalance')}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="acct-minpay">Minimum Payment</FieldLabel>
              <Input
                id="acct-minpay"
                placeholder="0.00"
                inputMode="decimal"
                {...register('minimumPayment')}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="acct-duedate">Due Date</FieldLabel>
              <Input id="acct-duedate" type="date" {...register('paymentDueDate')} />
            </Field>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <Field>
            <FieldLabel>Icon</FieldLabel>
            <Controller
              name="icon"
              control={control}
              render={({ field }) => (
                <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Account icon">
                  {ACCOUNT_ICON_OPTIONS.map((iconName) => {
                    const Icon = getIcon(iconName)
                    const selected = field.value === iconName
                    return (
                      <button
                        key={iconName}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        aria-label={iconName}
                        onClick={() => field.onChange(iconName)}
                        className={cn(
                          'flex size-9 items-center justify-center rounded-lg border transition-colors',
                          selected
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'text-muted-foreground hover:bg-accent',
                        )}
                      >
                        <Icon className="size-4" aria-hidden="true" />
                      </button>
                    )
                  })}
                </div>
              )}
            />
          </Field>
          <Field>
            <FieldLabel>Color</FieldLabel>
            <Controller
              name="color"
              control={control}
              render={({ field }) => (
                <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Account color">
                  {ACCOUNT_COLOR_OPTIONS.map((color) => {
                    const selected = field.value === color
                    return (
                      <button
                        key={color}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        aria-label={color}
                        onClick={() => field.onChange(color)}
                        className={cn(
                          'size-9 rounded-lg border-2 transition-transform',
                          selected ? 'border-foreground scale-110' : 'border-transparent',
                        )}
                        style={{ backgroundColor: color }}
                      />
                    )
                  })}
                </div>
              )}
            />
          </Field>
        </div>

        <Field>
          <FieldLabel htmlFor="acct-notes">Notes (optional)</FieldLabel>
          <Textarea
            id="acct-notes"
            rows={2}
            placeholder="Add any notes about this account"
            {...register('notes')}
          />
          <FieldError errors={[errors.notes]} />
        </Field>
      </FieldGroup>

      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {account ? 'Save Changes' : 'Add Account'}
        </Button>
      </div>
    </form>
  )
}
