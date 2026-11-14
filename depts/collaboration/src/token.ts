import { createHmac, timingSafeEqual } from 'node:crypto'

/** What the backend signs (`App\Core\Collaboration\CollaborationTokenIssuer`). */
export interface TokenPayload {
  /** Namespace: the uuid of the tenant. */
  ns: string
  /** Room: the id of the project. */
  room: string
  /** The user's uuid. */
  sub: string
  name: string
  /** Expiry, seconds since the epoch. */
  exp: number
}

/**
 * Checks `base64url(payload).base64url(hmac-sha256)` against the shared secret and the clock.
 * Returns the payload, or an Error saying what is wrong — never throws.
 */
export function verifyToken(
  token: unknown,
  secret: string,
  now: number = Date.now() / 1000,
): TokenPayload | Error {
  if (typeof token !== 'string') return new Error('No token provided.')

  const parts = token.split('.')
  if (parts.length !== 2) return new Error('Invalid token provided.')
  const [payload, signature] = parts as [string, string]

  const expected = createHmac('sha256', secret).update(payload).digest()
  const given = Buffer.from(signature, 'base64url')
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return new Error('Invalid token provided.')
  }

  let claims: Partial<TokenPayload>
  try {
    claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as Partial<TokenPayload>
  } catch {
    return new Error('Invalid token provided.')
  }

  if (
    typeof claims.ns !== 'string' ||
    typeof claims.room !== 'string' ||
    typeof claims.sub !== 'string' ||
    typeof claims.name !== 'string' ||
    typeof claims.exp !== 'number'
  ) {
    return new Error('Invalid token provided.')
  }

  if (claims.exp < now) return new Error('The token has expired.')

  return claims as TokenPayload
}
