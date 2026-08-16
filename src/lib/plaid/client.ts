import { supabase } from '@/lib/supabase/client'

async function authHeaders(): Promise<Record<string, string>> {
  if (!supabase) throw new Error('Cloud sync is not configured')
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error('Sign in to link a bank account')
  return { Authorization: `Bearer ${token}` }
}

async function postJSON<T>(url: string, body?: unknown): Promise<T> {
  const headers = await authHeaders()
  const res = await fetch(url, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error ?? 'Request failed')
  return json as T
}

export function createLinkToken(): Promise<{ linkToken: string }> {
  return postJSON('/api/plaid/create-link-token')
}

export function exchangePublicToken(
  publicToken: string,
  institutionName: string | null,
): Promise<{ linkedAccounts: number }> {
  return postJSON('/api/plaid/exchange-public-token', { publicToken, institutionName })
}

export function syncPlaidNow(): Promise<{ added: number; modified: number; removed: number }> {
  return postJSON('/api/plaid/sync')
}

export function unlinkPlaidItem(itemId: string): Promise<{ unlinked: boolean }> {
  return postJSON('/api/plaid/unlink', { itemId })
}
