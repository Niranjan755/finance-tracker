import Papa from 'papaparse'
import { toCents } from '@/lib/money'
import { toISODate } from '@/lib/date'
import type { Account, Category } from '@/types'

export interface ParsedCSV {
  headers: string[]
  rows: Record<string, string>[]
}

export function parseCSVFile(file: File): Promise<ParsedCSV> {
  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        resolve({ headers: result.meta.fields ?? [], rows: result.data })
      },
      error: (err: Error) => reject(err),
    })
  })
}

export interface ColumnMapping {
  date: string | null
  merchant: string | null
  amount: string | null
  category: string | null
  account: string | null
}

export interface ImportRowResult {
  rowIndex: number
  valid: boolean
  error?: string
  accountId?: string
  categoryId?: string
  type?: 'expense' | 'income'
  amountCents?: number
  date?: string
  merchant?: string
}

function tryParseDate(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return null

  // A bare "YYYY-MM-DD" is already in our canonical form - parsing it through
  // `new Date()` treats it as UTC midnight, which can shift a day once
  // reformatted in local time. Validate and return it directly instead.
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed)
  if (isoMatch) {
    const [, y, m, d] = isoMatch
    const date = new Date(Number(y), Number(m) - 1, Number(d))
    if (date.getFullYear() === Number(y) && date.getMonth() === Number(m) - 1 && date.getDate() === Number(d)) {
      return trimmed
    }
    return null
  }

  // Try MM/DD/YYYY.
  const slashMatch = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/.exec(trimmed)
  if (slashMatch) {
    const [, m, d, y] = slashMatch
    const year = y!.length === 2 ? Number(`20${y}`) : Number(y)
    const date = new Date(year, Number(m) - 1, Number(d))
    if (!Number.isNaN(date.getTime())) return toISODate(date)
    return null
  }

  // Fall back to the JS Date parser for anything else (e.g. "August 14, 2026").
  const parsed = new Date(trimmed)
  if (!Number.isNaN(parsed.getTime())) return toISODate(parsed)
  return null
}

export function validateImportRows(
  parsed: ParsedCSV,
  mapping: ColumnMapping,
  accounts: Account[],
  categories: Category[],
  defaultAccountId: string,
): ImportRowResult[] {
  const accountByName = new Map(accounts.map((a) => [a.name.toLowerCase(), a.id]))
  const categoryByName = new Map(categories.map((c) => [c.name.toLowerCase(), c]))

  return parsed.rows.map((row, rowIndex) => {
    if (!mapping.date || !mapping.amount) {
      return { rowIndex, valid: false, error: 'Date and Amount columns must be mapped' }
    }
    const rawDate = row[mapping.date] ?? ''
    const rawAmount = row[mapping.amount] ?? ''
    const rawMerchant = mapping.merchant ? (row[mapping.merchant] ?? '') : ''
    const rawCategory = mapping.category ? (row[mapping.category] ?? '') : ''
    const rawAccount = mapping.account ? (row[mapping.account] ?? '') : ''

    const date = tryParseDate(rawDate)
    if (!date) {
      return { rowIndex, valid: false, error: `Invalid date: "${rawDate}"` }
    }

    const cleanedAmount = rawAmount.trim().replace(/[$,]/g, '')
    if (!cleanedAmount || Number.isNaN(Number(cleanedAmount))) {
      return { rowIndex, valid: false, error: `Invalid amount: "${rawAmount}"` }
    }
    const signedCents = toCents(cleanedAmount)
    if (signedCents === 0) {
      return { rowIndex, valid: false, error: 'Amount cannot be zero' }
    }
    const type: 'expense' | 'income' = signedCents < 0 ? 'expense' : 'income'
    const amountCents = Math.abs(signedCents)

    let accountId = defaultAccountId
    if (rawAccount) {
      const matched = accountByName.get(rawAccount.trim().toLowerCase())
      if (!matched) {
        return { rowIndex, valid: false, error: `Unknown account: "${rawAccount}"` }
      }
      accountId = matched
    }
    if (!accountId) {
      return { rowIndex, valid: false, error: 'No account selected' }
    }

    const matchedCategory = rawCategory ? categoryByName.get(rawCategory.trim().toLowerCase()) : undefined
    const fallbackCategoryId = categories.find((c) => c.type === type && c.id === (type === 'expense' ? 'cat_exp_other' : 'cat_inc_other-income'))?.id
    const categoryId = matchedCategory?.id ?? fallbackCategoryId ?? categories.find((c) => c.type === type)?.id

    if (!categoryId) {
      return { rowIndex, valid: false, error: 'No matching category found' }
    }

    return {
      rowIndex,
      valid: true,
      accountId,
      categoryId,
      type,
      amountCents,
      date,
      merchant: rawMerchant.trim(),
    }
  })
}
