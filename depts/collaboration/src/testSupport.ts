import { createHmac } from 'node:crypto'

/** A token as the backend's `CollaborationTokenIssuer` signs it. */
export function sign(claims: Record<string, unknown>, secret = 'secret'): string {
  const payload = Buffer.from(JSON.stringify(claims)).toString('base64url')
  return `${payload}.${createHmac('sha256', secret).update(payload).digest('base64url')}`
}
