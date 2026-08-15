import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { ChevronLeft, ChevronRight, Plus, Target } from 'lucide-react'
import { PageHeader } from '@/components/finance/PageHeader'
import { EmptyState } from '@/components/finance/EmptyState'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { MoreVertical } from 'lucide-react'
import { BudgetForm } from '@/features/budgets/BudgetForm'
import { useFinanceStore } from '@/store/financeStore'
import { computeBudgetProgress, type BudgetStatus } from '@/lib/finance/calculations'
import { getIcon } from '@/lib/icons'
import { formatCurrency } from '@/lib/money'
import { getMonthBounds } from '@/lib/date'
import type { Budget } from '@/types'

const STATUS_LABEL: Record<BudgetStatus, string> = {
  normal: 'On track',
  warning: 'Getting close',
  'near-limit': 'Near limit',
  'over-budget': 'Over budget',
}

const STATUS_BAR_CLASS: Record<BudgetStatus, string> = {
  normal: '',
  warning: '[&>div]:bg-amber-500',
  'near-limit': '[&>div]:bg-orange-500',
  'over-budget': '[&>div]:bg-red-500',
}

const STATUS_TEXT_CLASS: Record<BudgetStatus, string> = {
  normal: 'text-muted-foreground',
  warning: 'text-amber-600 dark:text-amber-400',
  'near-limit': 'text-orange-600 dark:text-orange-400',
  'over-budget': 'text-red-600 dark:text-red-400',
}

export function BudgetsPage() {
  const budgets = useFinanceStore((s) => s.budgets)
  const transactions = useFinanceStore((s) => s.transactions)
  const categories = useFinanceStore((s) => s.categories)
  const accounts = useFinanceStore((s) => s.accounts)
  const addBudget = useFinanceStore((s) => s.addBudget)
  const updateBudget = useFinanceStore((s) => s.updateBudget)
  const removeBudget = useFinanceStore((s) => s.removeBudget)
  const currency = useFinanceStore((s) => s.settings.currency)

  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [formOpen, setFormOpen] = useState(false)
  const [editingBudget, setEditingBudget] = useState<Budget | undefined>(undefined)
  const [deletingBudget, setDeletingBudget] = useState<Budget | null>(null)

  const bounds = getMonthBounds(year, month)
  const monthBudgets = useMemo(
    () => budgets.filter((b) => b.year === year && b.month === month),
    [budgets, year, month],
  )
  const progress = useMemo(
    () => computeBudgetProgress(monthBudgets, transactions, categories, accounts, currency),
    [monthBudgets, transactions, categories, accounts, currency],
  )

  const totalBudgetCents = monthBudgets.reduce((s, b) => s + b.amountCents, 0)
  const totalSpentCents = progress.reduce((s, p) => s + p.spentCents, 0)

  function shiftMonth(delta: number) {
    const d = new Date(year, month - 1 + delta, 1)
    setYear(d.getFullYear())
    setMonth(d.getMonth() + 1)
  }

  function openAdd() {
    setEditingBudget(undefined)
    setFormOpen(true)
  }

  function openEdit(budget: Budget) {
    setEditingBudget(budget)
    setFormOpen(true)
  }

  async function handleSubmit(values: { categoryId: string; amountCents: number }) {
    try {
      if (editingBudget) {
        await updateBudget(editingBudget.id, { amountCents: values.amountCents })
        toast.success('Budget updated')
      } else {
        await addBudget({
          categoryId: values.categoryId,
          month,
          year,
          amountCents: values.amountCents,
        })
        toast.success('Budget created')
      }
      setFormOpen(false)
    } catch (err) {
      toast.error('Unable to save budget', {
        description: err instanceof Error ? err.message : undefined,
      })
    }
  }

  async function handleDelete() {
    if (!deletingBudget) return
    await removeBudget(deletingBudget.id)
    toast.success('Budget deleted')
    setDeletingBudget(null)
  }

  return (
    <div>
      <PageHeader
        title="Budgets"
        description="Set monthly spending limits by category."
        actions={
          <Button onClick={openAdd} className="gap-1.5">
            <Plus className="size-4" aria-hidden="true" />
            Add Budget
          </Button>
        }
      />

      <div className="mb-6 flex items-center justify-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => shiftMonth(-1)}
          aria-label="Previous month"
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
        </Button>
        <span className="min-w-36 text-center text-sm font-medium">{bounds.label}</span>
        <Button variant="ghost" size="icon" onClick={() => shiftMonth(1)} aria-label="Next month">
          <ChevronRight className="size-4" aria-hidden="true" />
        </Button>
      </div>

      {monthBudgets.length > 0 && (
        <Card className="mb-6 p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Total Budgeted</span>
            <span className="font-medium">
              {formatCurrency(totalSpentCents, currency)} /{' '}
              {formatCurrency(totalBudgetCents, currency)}
            </span>
          </div>
          <Progress
            value={Math.min((totalSpentCents / Math.max(totalBudgetCents, 1)) * 100, 100)}
            className="mt-2"
          />
        </Card>
      )}

      {monthBudgets.length === 0 ? (
        <EmptyState
          icon={Target}
          title="No budgets for this month"
          description="Set a monthly spending limit for a category to track your progress."
          action={
            <Button onClick={openAdd} className="gap-1.5">
              <Plus className="size-4" aria-hidden="true" />
              Add Budget
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {progress.map((p) => {
            const Icon = getIcon(p.category?.icon ?? 'circle-dashed')
            return (
              <Card key={p.budget.id} className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className="flex size-8 items-center justify-center rounded-lg"
                      style={{
                        backgroundColor: `${p.category?.color ?? '#6b7280'}1a`,
                        color: p.category?.color ?? '#6b7280',
                      }}
                    >
                      <Icon className="size-4" aria-hidden="true" />
                    </span>
                    <span className="font-medium">{p.category?.name ?? 'Category'}</span>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          aria-label={`Actions for ${p.category?.name}`}
                        >
                          <MoreVertical className="size-4" aria-hidden="true" />
                        </Button>
                      }
                    />
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openEdit(p.budget)}>Edit</DropdownMenuItem>
                      <DropdownMenuItem
                        variant="destructive"
                        onClick={() => setDeletingBudget(p.budget)}
                      >
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="mt-4 flex items-baseline justify-between text-sm">
                  <span className="font-semibold">{formatCurrency(p.spentCents, currency)}</span>
                  <span className="text-muted-foreground">
                    of {formatCurrency(p.budget.amountCents, currency)}
                  </span>
                </div>
                <Progress
                  value={Math.min(p.percentUsed, 100)}
                  className={`mt-2 ${STATUS_BAR_CLASS[p.status]}`}
                />
                <div className="mt-2 flex items-center justify-between text-xs">
                  <span className={STATUS_TEXT_CLASS[p.status]}>{STATUS_LABEL[p.status]}</span>
                  <span className="text-muted-foreground">
                    {p.percentUsed.toFixed(0)}% ·{' '}
                    {p.remainingCents >= 0
                      ? `${formatCurrency(p.remainingCents, currency)} left`
                      : `${formatCurrency(-p.remainingCents, currency)} over`}
                  </span>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{editingBudget ? 'Edit Budget' : 'Add Budget'}</DialogTitle>
          </DialogHeader>
          <BudgetForm
            categories={categories}
            budget={editingBudget}
            usedCategoryIds={monthBudgets.map((b) => b.categoryId)}
            onSubmit={handleSubmit}
            onCancel={() => setFormOpen(false)}
          />
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!deletingBudget}
        onOpenChange={(open) => !open && setDeletingBudget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this budget?</AlertDialogTitle>
            <AlertDialogDescription>This can't be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
