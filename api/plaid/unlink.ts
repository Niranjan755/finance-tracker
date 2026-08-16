import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireUser } from '../_lib/auth.js'
import { getPlaidClient } from '../_lib/plaid.js'
import { getServiceClient } from '../_lib/supabase.js'
import { loadAppState, saveAppState } from '../_lib/appState.js'

/**
 * Unlinks a bank (Plaid Item): revokes the access token with Plaid, deletes
 * the plaid_items row, and clears plaidAccountId/plaidItemId on the local
 * Account(s) so they go back to being ordinary manually-managed accounts.
 * The accounts and their transaction history are kept, not deleted.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  try {
    const user = await requireUser(req)
    const { itemId } = req.body as { itemId?: string }
    if (!itemId) {
      res.status(400).json({ error: 'itemId is required' })
      return
    }

    const supabase = getServiceClient()
    const { data: item, error: itemError } = await supabase
      .from('plaid_items')
      .select('access_token')
      .eq('item_id', itemId)
      .eq('user_id', user.id)
      .maybeSingle()
    if (itemError) throw new Error(itemError.message)
    if (!item) {
      res.status(404).json({ error: 'Linked bank not found' })
      return
    }

    const plaid = getPlaidClient()
    try {
      await plaid.itemRemove({ access_token: item.access_token })
    } catch {
      // Item may already be invalid/removed on Plaid's side - proceed with
      // cleaning up our own records regardless.
    }

    const { error: deleteError } = await supabase
      .from('plaid_items')
      .delete()
      .eq('item_id', itemId)
      .eq('user_id', user.id)
    if (deleteError) throw new Error(deleteError.message)

    const payload = await loadAppState(supabase, user.id)
    const updatedAccounts = payload.accounts.map((a) =>
      a.plaidItemId === itemId ? { ...a, plaidAccountId: null, plaidItemId: null } : a,
    )
    await saveAppState(supabase, user.id, { ...payload, accounts: updatedAccounts })

    res.status(200).json({ unlinked: true })
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Unable to unlink bank' })
  }
}
