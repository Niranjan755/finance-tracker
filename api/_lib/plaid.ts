import { Configuration, PlaidApi, PlaidEnvironments } from 'plaid'

export function getPlaidClient(): PlaidApi {
  const clientId = process.env.PLAID_CLIENT_ID
  const secret = process.env.PLAID_SECRET
  const env = process.env.PLAID_ENV ?? 'sandbox'
  if (!clientId || !secret) {
    throw new Error('PLAID_CLIENT_ID and PLAID_SECRET must be set')
  }
  const basePath = PlaidEnvironments[env as keyof typeof PlaidEnvironments]
  if (!basePath) {
    throw new Error(`Unknown PLAID_ENV "${env}" - expected sandbox, development, or production`)
  }

  const configuration = new Configuration({
    basePath,
    baseOptions: {
      headers: {
        'PLAID-CLIENT-ID': clientId,
        'PLAID-SECRET': secret,
      },
    },
  })
  return new PlaidApi(configuration)
}
