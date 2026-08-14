import { jsPDF } from 'jspdf'
import { autoTable } from 'jspdf-autotable'
import { formatCurrency } from '@/lib/money'
import { formatDisplayDate } from '@/lib/date'
import type { CategoryBreakdownEntry, MonthlyStatement } from '@/lib/finance/calculations'
import type { Account, Category, Currency } from '@/types'

export interface StatementPDFInput {
  userName: string
  statement: MonthlyStatement
  incomeBreakdown: CategoryBreakdownEntry[]
  expenseBreakdown: CategoryBreakdownEntry[]
  accounts: Account[]
  categories: Category[]
  currency: Currency
}

export function generateMonthlyStatementPDF(input: StatementPDFInput): jsPDF {
  const { statement, incomeBreakdown, expenseBreakdown, accounts, currency } = input
  const doc = new jsPDF({ unit: 'pt', format: 'letter' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const margin = 40
  let y = 50

  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.text('Finance Tracker', margin, y)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text('Monthly Financial Statement', margin, y + 16)

  doc.setFontSize(11)
  doc.text(statement.bounds.label, pageWidth - margin, y, { align: 'right' })
  if (input.userName) {
    doc.text(input.userName, pageWidth - margin, y + 16, { align: 'right' })
  }
  y += 40

  doc.setDrawColor(200)
  doc.line(margin, y, pageWidth - margin, y)
  y += 24

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    theme: 'plain',
    styles: { fontSize: 10, cellPadding: 4 },
    body: [
      ['Opening Balance', formatCurrency(statement.openingBalanceCents, currency)],
      ['Total Income', formatCurrency(statement.totalIncomeCents, currency)],
      ['Total Expenses', `-${formatCurrency(statement.totalExpenseCents, currency)}`],
      ['Total Transfers', formatCurrency(statement.totalTransfersCents, currency)],
      ['Net Cash Flow', formatCurrency(statement.netCashFlowCents, currency)],
      ['Closing Balance', formatCurrency(statement.closingBalanceCents, currency)],
      ['Savings Rate', `${statement.savingsRatePercent.toFixed(1)}%`],
      ['Transactions', String(statement.transactionCount)],
    ],
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 180 }, 1: { halign: 'right' } },
  })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  y = (doc as any).lastAutoTable.finalY + 24

  if (incomeBreakdown.length > 0) {
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.text('Income', margin, y)
    y += 8
    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [['Category', 'Amount']],
      body: incomeBreakdown.map((e) => [e.name, `+${formatCurrency(e.amountCents, currency)}`]),
      styles: { fontSize: 10 },
      headStyles: { fillColor: [16, 24, 40] },
      columnStyles: { 1: { halign: 'right' } },
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    y = (doc as any).lastAutoTable.finalY + 24
  }

  if (expenseBreakdown.length > 0) {
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.text('Expenses', margin, y)
    y += 8
    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [['Category', 'Amount']],
      body: expenseBreakdown.map((e) => [e.name, `-${formatCurrency(e.amountCents, currency)}`]),
      styles: { fontSize: 10 },
      headStyles: { fillColor: [16, 24, 40] },
      columnStyles: { 1: { halign: 'right' } },
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    y = (doc as any).lastAutoTable.finalY + 24
  }

  if (statement.largestExpense) {
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.text(
      `Largest expense: ${statement.largestExpense.merchant || 'Transaction'} - ${formatCurrency(statement.largestExpense.amountCents, currency)}`,
      margin,
      y,
    )
    y += 24
  }

  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text('Account Balances', margin, y)
  y += 8
  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [['Account', 'Type', 'Balance']],
    body: accounts.map((a) => [
      a.name,
      a.type,
      a.type === 'credit_card'
        ? `-${formatCurrency(a.balanceCents, a.currency)}`
        : formatCurrency(a.balanceCents, a.currency),
    ]),
    styles: { fontSize: 10 },
    headStyles: { fillColor: [16, 24, 40] },
    columnStyles: { 2: { halign: 'right' } },
  })

  const allTransactions = [...statement.incomeTransactions, ...statement.expenseTransactions].sort(
    (a, b) => a.date.localeCompare(b.date),
  )
  if (allTransactions.length > 0) {
    doc.addPage()
    y = 50
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.text('Transactions', margin, y)
    y += 8
    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [['Date', 'Merchant', 'Type', 'Amount']],
      body: allTransactions.map((t) => [
        formatDisplayDate(t.date),
        t.merchant || '-',
        t.type === 'expense' ? 'Expense' : 'Income',
        `${t.type === 'expense' ? '-' : '+'}${formatCurrency(t.amountCents, currency)}`,
      ]),
      styles: { fontSize: 9 },
      headStyles: { fillColor: [16, 24, 40] },
      columnStyles: { 3: { halign: 'right' } },
    })
  }

  return doc
}

export function downloadMonthlyStatementPDF(input: StatementPDFInput, filename: string): void {
  const doc = generateMonthlyStatementPDF(input)
  doc.save(filename)
}
