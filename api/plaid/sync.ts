import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireUser } from '../_lib/auth.js'
import { getServiceClient } from '../_lib/supabase.js'
import { syncPlaidItem } from '../_lib/plaidSync.js'

/** Manual "Sync Now" fallback - the webhook (api/plaid/webhook.ts) is what makes this automatic. */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  try {
    const user = await requireUser(req)
    const supabase = getServiceClient()

    const { data: items, error } = await supabase
      .from('plaid_items')
      .select('item_id')
      .eq('user_id', user.id)
    if (error) throw new Error(error.message)

    const results = await Promise.all((items ?? []).map((item) => syncPlaidItem(item.item_id)))
    const totals = results.reduce(
      (sum, r) => ({
        added: sum.added + r.added,
        modified: sum.modified + r.modified,
        removed: sum.removed + r.removed,
      }),
      { added: 0, modified: 0, removed: 0 },
    )

    res.status(200).json(totals)
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Unable to sync' })
  }
}
