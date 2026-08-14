import { getDB } from '@/lib/db/client'
import { generateId } from '@/lib/id'
import { toCents } from '@/lib/money'
import { toISODate } from '@/lib/date'
import { getDefaultCategories } from './categories'
import type { Account, Budget, Category, Transaction, Transfer } from '@/types'

function daysAgo(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return toISODate(d)
}

function pick<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)] as T
}

function randomAmount(minDollars: number, maxDollars: number): number {
  const v = minDollars + Math.random() * (maxDollars - minDollars)
  return toCents(v.toFixed(2))
}

/** Generates ~4 months of realistic demo data. Returns everything ready to write via replaceAllData. */
export async function generateDemoData(): Promise<{
  accounts: Account[]
  categories: Category[]
  transactions: Transaction[]
  transfers: Transfer[]
  budgets: Budget[]
}> {
  const now = new Date().toISOString()
  const categories = getDefaultCategories()
  const catByName = new Map(categories.map((c) => [c.name.toLowerCase(), c]))
  const cat = (name: string) => catByName.get(name.toLowerCase())!.id

  const checking: Account = {
    id: generateId('acct'),
    name: 'Chase Checking',
    institution: 'Chase',
    type: 'checking',
    lastFour: '4821',
    balanceCents: toCents('4250.50'),
    creditLimitCents: null,
    statementBalanceCents: null,
    minimumPaymentCents: null,
    paymentDueDate: null,
    currency: 'USD',
    icon: 'landmark',
    color: '#2a78d6',
    isActive: true,
    notes: '',
    createdAt: now,
    updatedAt: now,
  }
  const savings: Account = {
    ...checking,
    id: generateId('acct'),
    name: 'Chase Savings',
    type: 'savings',
    lastFour: '9012',
    balanceCents: toCents('12500'),
    icon: 'piggy-bank',
    color: '#1baf7a',
  }
  const sapphire: Account = {
    ...checking,
    id: generateId('acct'),
    name: 'Chase Sapphire',
    type: 'credit_card',
    lastFour: '1234',
    balanceCents: 0,
    creditLimitCents: toCents('5000'),
    icon: 'credit-card',
    color: '#eb6834',
  }
  const capitalOne: Account = {
    ...checking,
    id: generateId('acct'),
    name: 'Capital One',
    institution: 'Capital One',
    type: 'credit_card',
    lastFour: '5678',
    balanceCents: 0,
    creditLimitCents: toCents('3000'),
    icon: 'credit-card',
    color: '#e34948',
  }
  const cash: Account = {
    ...checking,
    id: generateId('acct'),
    name: 'Cash',
    institution: '',
    type: 'cash',
    lastFour: '',
    balanceCents: toCents('350'),
    icon: 'banknote',
    color: '#4b5563',
  }

  const accounts = [checking, savings, sapphire, capitalOne, cash]
  const transactions: Transaction[] = []
  const transfers: Transfer[] = []

  function addTransaction(input: {
    accountId: string
    categoryId: string
    type: 'expense' | 'income'
    amountCents: number
    merchant: string
    date: string
  }) {
    transactions.push({
      id: generateId('txn'),
      accountId: input.accountId,
      categoryId: input.categoryId,
      type: input.type,
      amountCents: input.amountCents,
      merchant: input.merchant,
      description: '',
      date: input.date,
      notes: '',
      tags: [],
      location: '',
      receiptId: null,
      recurringId: null,
      createdAt: now,
      updatedAt: now,
    })
  }

  function addTransfer(
    fromId: string,
    toId: string,
    amountCents: number,
    date: string,
    isCreditCardPayment = false,
  ) {
    transfers.push({
      id: generateId('xfer'),
      fromAccountId: fromId,
      toAccountId: toId,
      fromAmountCents: amountCents,
      toAmountCents: amountCents,
      exchangeRate: 1,
      date,
      description: isCreditCardPayment ? 'Credit card payment' : 'Transfer to savings',
      isCreditCardPayment,
      createdAt: now,
    })
  }

  const RESTAURANTS = ['Olive Garden', 'Chipotle', 'Local Bistro', 'Sushi House', 'Thai Palace']
  const COFFEE = ['Starbucks', 'Local Coffee Co', 'Peet’s Coffee']
  const GROCERIES = ['Whole Foods', 'Trader Joe’s', 'Safeway', 'Costco']
  const SHOPPING = ['Amazon', 'Target', 'Best Buy']

  // 120 days of history, biweekly paychecks, weekly groceries, assorted spending.
  for (let d = 119; d >= 0; d--) {
    const date = daysAgo(d)
    const dow = new Date(date).getDay()

    // Biweekly salary.
    if (d % 14 === 0) {
      addTransaction({
        accountId: checking.id,
        categoryId: cat('Salary'),
        type: 'income',
        amountCents: toCents('4100'),
        merchant: 'Employer Inc',
        date,
      })
    }
    // Monthly rent, on the 1st-ish.
    if (d % 30 === 1) {
      addTransaction({
        accountId: checking.id,
        categoryId: cat('Rent'),
        type: 'expense',
        amountCents: toCents('2000'),
        merchant: 'Property Management Co',
        date,
      })
    }
    // Weekly groceries.
    if (dow === 6) {
      addTransaction({
        accountId: checking.id,
        categoryId: cat('Groceries'),
        type: 'expense',
        amountCents: randomAmount(60, 140),
        merchant: pick(GROCERIES),
        date,
      })
    }
    // Restaurants a few times a week.
    if (Math.random() < 0.35) {
      addTransaction({
        accountId: sapphire.id,
        categoryId: cat('Restaurants'),
        type: 'expense',
        amountCents: randomAmount(15, 85),
        merchant: pick(RESTAURANTS),
        date,
      })
    }
    // Coffee often.
    if (Math.random() < 0.5) {
      addTransaction({
        accountId: cash.id,
        categoryId: cat('Coffee'),
        type: 'expense',
        amountCents: randomAmount(4, 9),
        merchant: pick(COFFEE),
        date,
      })
    }
    // Shopping occasionally.
    if (Math.random() < 0.12) {
      addTransaction({
        accountId: capitalOne.id,
        categoryId: cat('Amazon'),
        type: 'expense',
        amountCents: randomAmount(20, 150),
        merchant: pick(SHOPPING),
        date,
      })
    }
    // Gas weekly-ish.
    if (dow === 3) {
      addTransaction({
        accountId: sapphire.id,
        categoryId: cat('Gas'),
        type: 'expense',
        amountCents: randomAmount(35, 60),
        merchant: 'Shell',
        date,
      })
    }
    // Streaming, monthly.
    if (d % 30 === 15) {
      addTransaction({
        accountId: sapphire.id,
        categoryId: cat('Streaming'),
        type: 'expense',
        amountCents: toCents('15.99'),
        merchant: 'Netflix',
        date,
      })
    }
    // Utilities, monthly.
    if (d % 30 === 5) {
      addTransaction({
        accountId: checking.id,
        categoryId: cat('Electricity'),
        type: 'expense',
        amountCents: randomAmount(60, 120),
        merchant: 'PG&E',
        date,
      })
      addTransaction({
        accountId: checking.id,
        categoryId: cat('Internet'),
        type: 'expense',
        amountCents: toCents('80'),
        merchant: 'Comcast',
        date,
      })
    }
    // Transfer to savings monthly.
    if (d % 30 === 3) {
      addTransfer(checking.id, savings.id, toCents('500'), date)
    }
    // Credit card payments monthly.
    if (d % 30 === 20) {
      const sapphireBalance = accounts.find((a) => a.id === sapphire.id)!.balanceCents
      if (sapphireBalance > 0) {
        addTransfer(checking.id, sapphire.id, Math.min(sapphireBalance, toCents('400')), date, true)
      }
    }
  }

  // Apply all deltas to compute realistic ending balances, starting from the seed balances above (which represent the CURRENT/final state as configured).
  // To keep this simple and correct, we instead treat the configured balances as the state BEFORE these transactions, then apply deltas forward.
  const accountById = new Map(accounts.map((a) => [a.id, a]))
  function isLiability(id: string) {
    return accountById.get(id)!.type === 'credit_card'
  }
  const sorted = [...transactions].sort((a, b) => a.date.localeCompare(b.date))
  for (const t of sorted) {
    const account = accountById.get(t.accountId)!
    const liability = isLiability(account.id)
    const delta =
      t.type === 'expense'
        ? liability
          ? t.amountCents
          : -t.amountCents
        : liability
          ? -t.amountCents
          : t.amountCents
    account.balanceCents += delta
  }
  const sortedTransfers = [...transfers].sort((a, b) => a.date.localeCompare(b.date))
  for (const t of sortedTransfers) {
    const from = accountById.get(t.fromAccountId)!
    const to = accountById.get(t.toAccountId)!
    from.balanceCents += isLiability(from.id) ? t.fromAmountCents : -t.fromAmountCents
    to.balanceCents += isLiability(to.id) ? -t.toAmountCents : t.toAmountCents
  }

  const budgets: Budget[] = [
    {
      id: generateId('budget'),
      categoryId: cat('Food'),
      month: new Date().getMonth() + 1,
      year: new Date().getFullYear(),
      amountCents: toCents('600'),
    },
    {
      id: generateId('budget'),
      categoryId: cat('Entertainment'),
      month: new Date().getMonth() + 1,
      year: new Date().getFullYear(),
      amountCents: toCents('150'),
    },
  ]

  return { accounts, categories, transactions, transfers, budgets }
}

export async function seedDemoDataIntoDB(): Promise<void> {
  const { accounts, categories, transactions, transfers, budgets } = await generateDemoData()
  const db = await getDB()
  await Promise.all(
    (['accounts', 'categories', 'transactions', 'transfers', 'budgets'] as const).map((s) =>
      db.clear(s),
    ),
  )
  const tx = db.transaction(
    ['accounts', 'categories', 'transactions', 'transfers', 'budgets'],
    'readwrite',
  )
  await Promise.all([
    ...accounts.map((a) => tx.objectStore('accounts').put(a)),
    ...categories.map((c) => tx.objectStore('categories').put(c)),
    ...transactions.map((t) => tx.objectStore('transactions').put(t)),
    ...transfers.map((t) => tx.objectStore('transfers').put(t)),
    ...budgets.map((b) => tx.objectStore('budgets').put(b)),
    tx.done,
  ])
}
