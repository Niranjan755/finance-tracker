import type { VercelRequest, VercelResponse } from '@vercel/node'
import { Products, CountryCode } from 'plaid'
import { requireUser } from '../_lib/auth.js'
import { getPlaidClient } from '../_lib/plaid.js'

function webhookUrl(): string | undefined {
  if (process.env.PLAID_WEBHOOK_URL) return process.env.PLAID_WEBHOOK_URL
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}/api/plaid/webhook`
  return undefined
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  try {
    const user = await requireUser(req)
    const plaid = getPlaidClient()

    const response = await plaid.linkTokenCreate({
      client_name: 'Finance Tracker',
      user: { client_user_id: user.id },
      products: [Products.Transactions],
      country_codes: [CountryCode.Us],
      language: 'en',
      webhook: webhookUrl(),
    })

    res.status(200).json({ linkToken: response.data.link_token })
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Unable to create link token' })
  }
}
