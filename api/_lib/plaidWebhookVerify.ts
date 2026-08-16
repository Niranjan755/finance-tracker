import { createHash } from 'node:crypto'
import { importJWK, jwtVerify, type JWK } from 'jose'
import { getPlaidClient } from './plaid.js'

// Plaid signs webhooks with a small set of keys that rotate infrequently and
// explicitly recommends caching them (up to 24h) rather than fetching fresh
// on every request. This only helps within a warm serverless instance - a
// cold start just re-fetches, which is still correct, just not as fast.
const keyCache = new Map<string, { key: JWK; expiresAt: number }>()
const CACHE_TTL_MS = 24 * 60 * 60 * 1000
const MAX_WEBHOOK_AGE_SECONDS = 5 * 60

async function getVerificationKey(keyId: string): Promise<JWK> {
  const cached = keyCache.get(keyId)
  if (cached && cached.expiresAt > Date.now()) return cached.key

  const plaid = getPlaidClient()
  const response = await plaid.webhookVerificationKeyGet({ key_id: keyId })
  const key = response.data.key as unknown as JWK
  keyCache.set(keyId, { key, expiresAt: Date.now() + CACHE_TTL_MS })
  return key
}

function decodeJwtHeader(token: string): { kid?: string } | null {
  const [headerPart] = token.split('.')
  if (!headerPart) return null
  try {
    return JSON.parse(Buffer.from(headerPart, 'base64url').toString('utf8')) as { kid?: string }
  } catch {
    return null
  }
}

/**
 * Verifies a Plaid webhook per Plaid's documented flow: the `Plaid-Verification`
 * header is a JWT signed with a key Plaid publishes per `kid`; once verified,
 * its `request_body_sha256` claim must match the SHA-256 of the exact raw
 * request body actually received (so `rawBody` must be the untouched bytes,
 * not a re-serialized copy - JSON.stringify(parsed) is not guaranteed to
 * reproduce the original byte sequence).
 */
export async function verifyPlaidWebhook(
  verificationHeader: string | string[] | undefined,
  rawBody: string,
): Promise<boolean> {
  const token = Array.isArray(verificationHeader) ? verificationHeader[0] : verificationHeader
  if (!token) return false

  const header = decodeJwtHeader(token)
  if (!header?.kid) return false

  let payload: Record<string, unknown>
  try {
    const jwk = await getVerificationKey(header.kid)
    const key = await importJWK(jwk, 'ES256')
    const result = await jwtVerify(token, key, { algorithms: ['ES256'] })
    payload = result.payload
  } catch {
    return false
  }

  const issuedAt = typeof payload.iat === 'number' ? payload.iat : null
  if (!issuedAt || Date.now() / 1000 - issuedAt > MAX_WEBHOOK_AGE_SECONDS) return false

  const expectedHash = createHash('sha256').update(rawBody, 'utf8').digest('hex')
  return payload.request_body_sha256 === expectedHash
}
