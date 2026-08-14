import { useState } from 'react'
import { toast } from 'sonner'
import { CheckCircle2, Sparkles, Wallet2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card } from '@/components/ui/card'
import { AccountForm } from '@/features/accounts/AccountForm'
import { ExpenseIncomeForm } from '@/features/transactions/ExpenseIncomeForm'
import { useFinanceStore } from '@/store/financeStore'
import { CURRENCIES, toCents } from '@/lib/money'
import type { AccountFormValues } from '@/lib/validation/account'
import type { Account, Currency } from '@/types'

type Step = 'welcome' | 'currency' | 'account' | 'transaction' | 'done'

const STEP_ORDER: Step[] = ['welcome', 'currency', 'account', 'transaction', 'done']

export function OnboardingFlow() {
  const [step, setStep] = useState<Step>('welcome')
  const [createdAccount, setCreatedAccount] = useState<Account | null>(null)

  const settings = useFinanceStore((s) => s.settings)
  const categories = useFinanceStore((s) => s.categories)
  const updateSettings = useFinanceStore((s) => s.updateSettings)
  const addAccount = useFinanceStore((s) => s.addAccount)
  const addExpense = useFinanceStore((s) => s.addExpense)
  const loadDemoData = useFinanceStore((s) => s.loadDemoData)

  async function finish() {
    await updateSettings({ onboardingComplete: true })
  }

  async function handleSkip() {
    await finish()
  }

  async function handleLoadDemoData() {
    await loadDemoData()
    await finish()
    toast.success('Demo data loaded - explore away!')
  }

  async function handleAccountSubmit(values: AccountFormValues) {
    const account = await addAccount({
      name: values.name,
      institution: values.institution,
      type: values.type,
      lastFour: values.lastFour,
      startingBalanceCents: toCents(values.startingBalance),
      creditLimitCents: values.type === 'credit_card' ? toCents(values.creditLimit) : null,
      currency: values.currency,
      icon: values.icon,
      color: values.color,
      notes: values.notes,
    })
    setCreatedAccount(account)
    toast.success('Account added')
    setStep('transaction')
  }

  const stepIndex = STEP_ORDER.indexOf(step)

  return (
    <div className="bg-muted/30 flex min-h-svh flex-col items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex gap-1.5">
            {STEP_ORDER.map((s, i) => (
              <span
                key={s}
                className={`h-1.5 w-8 rounded-full ${i <= stepIndex ? 'bg-primary' : 'bg-muted'}`}
              />
            ))}
          </div>
          {step !== 'done' && (
            <Button variant="ghost" size="sm" onClick={handleSkip}>
              Skip
            </Button>
          )}
        </div>

        <Card className="p-8">
          {step === 'welcome' && (
            <div className="space-y-6 text-center">
              <div className="bg-primary text-primary-foreground mx-auto flex size-14 items-center justify-center rounded-2xl">
                <Wallet2 className="size-7" aria-hidden="true" />
              </div>
              <div>
                <h1 className="text-2xl font-semibold">Welcome to Finance Tracker</h1>
                <p className="text-muted-foreground mt-2">
                  Track accounts, transactions, budgets, and net worth - entirely on this device.
                  Nothing is ever sent to a server.
                </p>
              </div>
              <div className="flex flex-col gap-2">
                <Button onClick={() => setStep('currency')} size="lg">
                  Get Started
                </Button>
                <Button variant="outline" onClick={handleLoadDemoData} className="gap-1.5">
                  <Sparkles className="size-4" aria-hidden="true" />
                  Explore with Demo Data
                </Button>
              </div>
            </div>
          )}

          {step === 'currency' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold">Select Your Currency</h2>
                <p className="text-muted-foreground mt-1 text-sm">
                  You can change this later in Settings.
                </p>
              </div>
              <Select
                value={settings.currency}
                onValueChange={(v) => v && updateSettings({ currency: v as Currency })}
                items={Object.fromEntries(CURRENCIES.map((c) => [c.code, `${c.code} - ${c.name}`]))}
              >
                <SelectTrigger className="w-full">
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
              <Button onClick={() => setStep('account')} className="w-full">
                Continue
              </Button>
            </div>
          )}

          {step === 'account' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold">Add Your First Account</h2>
                <p className="text-muted-foreground mt-1 text-sm">
                  A checking account, credit card, or cash wallet - whatever you'd like to track.
                </p>
              </div>
              <AccountForm onSubmit={handleAccountSubmit} onCancel={() => setStep('transaction')} />
            </div>
          )}

          {step === 'transaction' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold">Add Your First Transaction</h2>
                <p className="text-muted-foreground mt-1 text-sm">
                  Log a recent expense to see how it works.
                </p>
              </div>
              {createdAccount ? (
                <ExpenseIncomeForm
                  type="expense"
                  accounts={[createdAccount]}
                  categories={categories}
                  onSubmit={async (values) => {
                    await addExpense(values)
                    toast.success('Expense added')
                    setStep('done')
                  }}
                  onCancel={() => setStep('done')}
                />
              ) : (
                <div className="text-muted-foreground space-y-4 text-center text-sm">
                  <p>Add an account first to log a transaction.</p>
                  <Button variant="outline" onClick={() => setStep('account')}>
                    Back
                  </Button>
                </div>
              )}
            </div>
          )}

          {step === 'done' && (
            <div className="space-y-6 text-center">
              <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="size-7" aria-hidden="true" />
              </div>
              <div>
                <h2 className="text-2xl font-semibold">You're ready!</h2>
                <p className="text-muted-foreground mt-2">
                  Your dashboard is set up. Add more accounts and transactions any time.
                </p>
              </div>
              <Button onClick={finish} size="lg" className="w-full">
                Go to Dashboard
              </Button>
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
