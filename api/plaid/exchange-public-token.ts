import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireUser } from '../_lib/auth.js'
import { getPlaidClient } from '../_lib/plaid.js'
import { getServiceClient } from '../_lib/supabase.js'
import { loadAppState, saveAppState, upsertAccount, type AppSnapshot } from '../_lib/appState.js'
import { toAppAccount } from '../_lib/plaidAccount.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  try {
    const user = await requireUser(req)
    const { publicToken, institutionName } = req.body as {
      publicToken?: string
      institutionName?: string
    }
    if (!publicToken) {
      res.status(400).json({ error: 'publicToken is required' })
      return
    }

    const plaid = getPlaidClient()
    const exchangeResponse = await plaid.itemPublicTokenExchange({ public_token: publicToken })
    const accessToken = exchangeResponse.data.access_token
    const itemId = exchangeResponse.data.item_id

    const supabase = getServiceClient()
    const { error: insertError } = await supabase.from('plaid_items').insert({
      user_id: user.id,
      item_id: itemId,
      access_token: accessToken,
      institution_name: institutionName ?? null,
    })
    if (insertError) throw new Error(insertError.message)

    const accountsResponse = await plaid.accountsGet({ access_token: accessToken })
    const now = new Date().toISOString()

    let payload: AppSnapshot = await loadAppState(supabase, user.id)
    for (const plaidAccount of accountsResponse.data.accounts) {
      payload = upsertAccount(
        payload,
        toAppAccount(plaidAccount, itemId, institutionName ?? null, now),
      )
    }
    await saveAppState(supabase, user.id, payload)

    res.status(200).json({ linkedAccounts: accountsResponse.data.accounts.length })
  } catch (err) {
    res
      .status(400)
      .json({ error: err instanceof Error ? err.message : 'Unable to link bank account' })
  }
}
