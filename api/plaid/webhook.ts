import type { VercelRequest, VercelResponse } from '@vercel/node'
import { syncPlaidItem } from '../_lib/plaidSync.js'
import { verifyPlaidWebhook } from '../_lib/plaidWebhookVerify.js'

// Verifying the signature requires the exact raw bytes Plaid sent (see
// plaidWebhookVerify.ts) - disable Vercel's automatic JSON body parsing so
// we can read and hash the untouched body ourselves before trusting it.
export const config = {
  api: {
    bodyParser: false,
  },
}

async function readRawBody(req: VercelRequest): Promise<string> {
  const chunks: Buffer[] = []
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : (chunk as Buffer))
  }
  return Buffer.concat(chunks).toString('utf8')
}

/**
 * Plaid calls this whenever new transaction data is ready for an Item. This
 * is what makes sync automatic - no button, no polling. Registered
 * automatically via the `webhook` field passed in create-link-token.ts.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const rawBody = await readRawBody(req)
  const verified = await verifyPlaidWebhook(req.headers['plaid-verification'], rawBody)
  if (!verified) {
    res.status(401).json({ error: 'Invalid webhook signature' })
    return
  }

  const body = JSON.parse(rawBody) as { webhook_type?: string; item_id?: string }

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
