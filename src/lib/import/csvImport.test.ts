import { describe, expect, it } from 'vitest'
import { toCents } from '@/lib/money'
import type { Account, Category } from '@/types'
import { validateImportRows, type ColumnMapping, type ParsedCSV } from './csvImport'

const accounts: Account[] = [
  {
    id: 'checking',
    name: 'Chase Checking',
    institution: '',
    type: 'checking',
    lastFour: '',
    balanceCents: 0,
    creditLimitCents: null,
    statementBalanceCents: null,
    minimumPaymentCents: null,
    paymentDueDate: null,
    currency: 'USD',
    icon: '',
    color: '',
    isActive: true,
    notes: '',
    createdAt: '',
    updatedAt: '',
  },
]

const categories: Category[] = [
  {
    id: 'cat_exp_other',
    name: 'Other',
    type: 'expense',
    parentId: null,
    icon: '',
    color: '',
    isDefault: true,
  },
  {
    id: 'cat_inc_other-income',
    name: 'Other Income',
    type: 'income',
    parentId: null,
    icon: '',
    color: '',
    isDefault: true,
  },
  {
    id: 'groceries',
    name: 'Groceries',
    type: 'expense',
    parentId: null,
    icon: '',
    color: '',
    isDefault: true,
  },
]

const mapping: ColumnMapping = {
  date: 'Date',
  merchant: 'Description',
  amount: 'Amount',
  category: 'Category',
  account: null,
}

describe('validateImportRows', () => {
  it('parses a valid expense row (negative amount) and matches an existing category', () => {
    const parsed: ParsedCSV = {
      headers: ['Date', 'Description', 'Amount', 'Category'],
      rows: [
        { Date: '2026-08-14', Description: 'Whole Foods', Amount: '-82.40', Category: 'Groceries' },
      ],
    }
    const [result] = validateImportRows(parsed, mapping, accounts, categories, 'checking')
    expect(result).toMatchObject({
      valid: true,
      type: 'expense',
      amountCents: toCents('82.40'),
      date: '2026-08-14',
      merchant: 'Whole Foods',
      categoryId: 'groceries',
    })
  })

  it('parses a valid income row (positive amount) and falls back to Other Income when uncategorized', () => {
    const parsed: ParsedCSV = {
      headers: ['Date', 'Description', 'Amount', 'Category'],
      rows: [{ Date: '08/14/2026', Description: 'Payroll', Amount: '4200.00', Category: '' }],
    }
    const [result] = validateImportRows(parsed, mapping, accounts, categories, 'checking')
    expect(result).toMatchObject({
      valid: true,
      type: 'income',
      amountCents: toCents('4200'),
      date: '2026-08-14',
      categoryId: 'cat_inc_other-income',
    })
  })

  it('rejects an unparseable date', () => {
    const parsed: ParsedCSV = {
      headers: ['Date', 'Amount'],
      rows: [{ Date: 'not-a-date', Amount: '-10' }],
    }
    const [result] = validateImportRows(
      parsed,
      { ...mapping, category: null },
      accounts,
      categories,
      'checking',
    )
    expect(result?.valid).toBe(false)
    expect(result?.error).toContain('Invalid date')
  })

  it('rejects a zero amount', () => {
    const parsed: ParsedCSV = {
      headers: ['Date', 'Amount'],
      rows: [{ Date: '2026-08-14', Amount: '0' }],
    }
    const [result] = validateImportRows(
      parsed,
      { ...mapping, category: null },
      accounts,
      categories,
      'checking',
    )
    expect(result?.valid).toBe(false)
    expect(result?.error).toBe('Amount cannot be zero')
  })

  it('rejects an unknown account name when an account column is mapped', () => {
    const parsed: ParsedCSV = {
      headers: ['Date', 'Amount', 'Account'],
      rows: [{ Date: '2026-08-14', Amount: '-10', Account: 'Unknown Bank' }],
    }
    const [result] = validateImportRows(
      parsed,
      { ...mapping, account: 'Account', category: null },
      accounts,
      categories,
      'checking',
    )
    expect(result?.valid).toBe(false)
    expect(result?.error).toContain('Unknown account')
  })

  it('strips currency symbols and thousands separators from amounts', () => {
    const parsed: ParsedCSV = {
      headers: ['Date', 'Amount'],
      rows: [{ Date: '2026-08-14', Amount: '-$1,234.56' }],
    }
    const [result] = validateImportRows(
      parsed,
      { ...mapping, category: null },
      accounts,
      categories,
      'checking',
    )
    expect(result).toMatchObject({ valid: true, amountCents: toCents('1234.56') })
  })
})
