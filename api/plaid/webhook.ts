import type { VercelRequest, VercelResponse } from '@vercel/node'
import { syncPlaidItem } from '../_lib/plaidSync.js'

/**
 * Plaid calls this whenever new transaction data is ready for an Item. This
 * is what makes sync automatic - no button, no polling. Registered
 * automatically via the `webhook` field passed in create-link-token.ts.
 *
 * SECURITY NOTE: this does not yet verify Plaid's webhook signature
 * (the `Plaid-Verification` JWT header - see Plaid's webhook verification
 * docs). That's fine for Sandbox testing, where there's no real financial
 * data and no real attacker incentive, but it MUST be added before this
 * goes anywhere near Production - right now anyone who discovers this URL
 * could POST a fake `item_id` and trigger a sync for it.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const body = req.body as { webhook_type?: string; item_id?: string }

  // Acknowledge immediately regardless - Plaid retries on non-2xx, and we
  // don't want a slow/failed sync to look like a webhook delivery failure.
  res.status(200).json({ received: true })

  if (body.webhook_type !== 'TRANSACTIONS' || !body.item_id) return

  try {
    await syncPlaidItem(body.item_id)
  } catch (err) {
    console.error('Plaid webhook sync failed', body.item_id, err)
  }
}
