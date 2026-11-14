import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import { io } from 'socket.io-client'
import type { Socket } from 'socket.io-client'
import SocketServer from './SocketServer.ts'
import { sign } from './testSupport.ts'
import type { JoinAck } from './types.ts'

const SECRET = 'test-secret'
const TENANT = '019b0000-0000-7000-8000-000000000001'
const OTHER_TENANT = '019b0000-0000-7000-8000-000000000002'
const PROJECT = '019b0000-0000-7000-8000-0000000000a1'
const OTHER_PROJECT = '019b0000-0000-7000-8000-0000000000a2'

const server = new SocketServer({ port: 0, maxClientsPerRoom: 2, secret: SECRET })
server.listen()
const sockets: Socket[] = []

after(async () => {
  for (const socket of sockets) socket.close()
  await server.close()
})

function token(overrides: Record<string, unknown> = {}, secret = SECRET): string {
  const claims = {
    ns: TENANT,
    room: PROJECT,
    sub: 'user',
    name: 'Erika',
    exp: Date.now() / 1000 + 60,
    ...overrides,
  }
  return sign(claims, secret)
}

function connect(namespace: string, auth: Record<string, unknown>): Socket {
  const socket = io(`http://localhost:${server.port}/${namespace}`, {
    auth,
    reconnection: false,
    transports: ['websocket'],
  })
  sockets.push(socket)
  return socket
}

/** Resolves with the join answer, or rejects with the handshake error. */
function join(socket: Socket): Promise<JoinAck> {
  return new Promise((resolve, reject) => {
    socket.on('connect_error', reject)
    socket.on('connect', () => {
      socket.emit('app:join', resolve)
    })
  })
}

function once<T>(socket: Socket, event: string): Promise<T> {
  return new Promise(resolve => socket.once(event, resolve))
}

test('a signed token for the namespace joins the room', async () => {
  const ack = await join(connect(TENANT, { token: token() }))

  assert.equal(ack.clients, 1)
  assert.equal(ack.user.name, 'Erika')
  assert.equal(ack.users.length, 1)
  assert.equal(ack.users[0]?.me, true)
})

test('refuses a missing or forged token, an expired token and one for another namespace', async () => {
  await assert.rejects(join(connect(TENANT, {})), /No token/)
  await assert.rejects(join(connect(TENANT, { token: token({}, 'other-secret') })), /Invalid token/)
  await assert.rejects(join(connect(TENANT, { token: token({ exp: 1 }) })), /expired/)
  await assert.rejects(join(connect(OTHER_TENANT, { token: token() })), /another namespace/)
})

test('refuses a namespace that is no tenant uuid', async () => {
  await assert.rejects(join(connect('admin', { token: token({ ns: 'admin' }) })))
})

test('the others in the room hear who joined and who left', async () => {
  const room = { token: token({ room: OTHER_PROJECT }) }
  const first = connect(TENANT, room)
  await join(first)

  const joined = once<{ clients: number; user: { name: string } }>(first, 'app:joined')
  const second = connect(TENANT, { token: token({ room: OTHER_PROJECT, name: 'Max' }) })
  const ack = await join(second)

  assert.equal(ack.clients, 2)
  assert.deepEqual(ack.users.map(user => user.name).sort(), ['Erika', 'Max'])
  assert.equal((await joined).user.name, 'Max')
  assert.equal((await joined).clients, 2)

  const left = once<{ clients: number; userId: string }>(first, 'app:left')
  second.close()
  const message = await left
  assert.equal(message.clients, 1)
  assert.equal(message.userId, ack.user.id)
})

test('a full room refuses the next socket and says who is in it', async () => {
  const room = (name: string) => ({ token: token({ room: '019b0000-0000-7000-8000-0000000000a3', name }) })
  await join(connect(TENANT, room('A')))
  await join(connect(TENANT, room('B')))

  await assert.rejects(join(connect(TENANT, room('C'))), (error: Error & { data?: { code: string; limit: number; users: { name: string }[] } }) => {
    assert.equal(error.data?.code, 'room-full')
    assert.equal(error.data?.limit, 2)
    assert.deepEqual(error.data?.users.map(user => user.name).sort(), ['A', 'B'])
    return true
  })
})

test('rooms and tenants do not see each other', async () => {
  const lonely = connect(TENANT, { token: token({ room: '019b0000-0000-7000-8000-0000000000a4' }) })
  await join(lonely)
  let heard = false
  lonely.on('app:joined', () => (heard = true))

  const sameRoomName = await join(connect(OTHER_TENANT, { token: token({ ns: OTHER_TENANT, room: '019b0000-0000-7000-8000-0000000000a4' }) }))
  await join(connect(TENANT, { token: token({ room: '019b0000-0000-7000-8000-0000000000a5' }) }))

  assert.equal(sameRoomName.clients, 1)
  assert.equal(heard, false)
})
