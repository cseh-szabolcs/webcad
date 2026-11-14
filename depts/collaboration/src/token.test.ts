import assert from 'node:assert/strict'
import { test } from 'node:test'
import { verifyToken } from './token.ts'
import { sign } from './testSupport.ts'

const SECRET = 'secret'
const NOW = 1_000_000

const claims = { ns: 'tenant', room: 'project', sub: 'user', name: 'Erika', exp: NOW + 60 }

test('accepts a signed token', () => {
  assert.deepEqual(verifyToken(sign(claims), SECRET, NOW), claims)
})

test('refuses a token signed with another secret', () => {
  assert.ok(verifyToken(sign(claims, 'other'), SECRET, NOW) instanceof Error)
})

test('refuses a changed payload', () => {
  const [, signature] = sign(claims).split('.')
  const forged = Buffer.from(JSON.stringify({ ...claims, ns: 'other' })).toString('base64url')
  assert.ok(verifyToken(`${forged}.${signature}`, SECRET, NOW) instanceof Error)
})

test('refuses an expired token', () => {
  const result = verifyToken(sign({ ...claims, exp: NOW - 1 }), SECRET, NOW)
  assert.ok(result instanceof Error)
  assert.match(result.message, /expired/)
})

test('refuses a missing, malformed or incomplete token', () => {
  assert.ok(verifyToken(undefined, SECRET, NOW) instanceof Error)
  assert.ok(verifyToken('nonsense', SECRET, NOW) instanceof Error)
  assert.ok(verifyToken(sign({ ns: 'tenant' }), SECRET, NOW) instanceof Error)
})
