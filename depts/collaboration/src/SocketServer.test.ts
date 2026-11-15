import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import { io } from 'socket.io-client'
import type { Socket } from 'socket.io-client'
import SocketServer from './SocketServer.ts'
import { sign } from './testSupport.ts'
import { CHANGE_LIMIT, SELECTION_ID_LENGTH, SELECTION_LIMIT } from './types.ts'
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

const CURSOR_ROOM = '019b0000-0000-7000-8000-0000000000b1'

/** Two joined sockets in their own room, so the tests do not hear each other. */
async function pair(room: string) {
  const first = connect(TENANT, { token: token({ room, name: 'Erika' }) })
  const firstAck = await join(first)
  const second = connect(TENANT, { token: token({ room, name: 'Max' }) })
  const secondAck = await join(second)
  return { first, second, firstAck, secondAck }
}

/** Resolves once nothing has arrived for `ms`: the way to check that something was not sent. */
function silence(socket: Socket, event: string, ms = 150): Promise<unknown[]> {
  const received: unknown[] = []
  socket.on(event, (...args: unknown[]) => received.push(args))
  return new Promise(resolve => setTimeout(() => resolve(received), ms))
}

test('hands out the lowest free colour and takes a left one back', async () => {
  const room = '019b0000-0000-7000-8000-0000000000b2'
  const { first, second, firstAck, secondAck } = await pair(room)
  assert.deepEqual([firstAck.user.color, secondAck.user.color], [0, 1])

  const left = once(second, 'app:left')
  first.close()
  await left

  const third = await join(connect(TENANT, { token: token({ room, name: 'Lena' }) }))
  assert.equal(third.user.color, 0)
})

test('a pointer position reaches the others with the sender the server knows', async () => {
  const { first, second, firstAck } = await pair(CURSOR_ROOM)

  const heard = new Promise<unknown[]>(resolve => second.once('app:cursor', (...args: unknown[]) => resolve(args)))
  first.emit('app:cursor', 12.5, -3)
  const [userId, x, y] = await heard

  assert.equal(userId, firstAck.user.id)
  assert.equal(x, 12.5)
  assert.equal(y, -3)
})

test('the sender does not hear its own pointer, and what is no pair of numbers is dropped', async () => {
  const { first, second } = await pair('019b0000-0000-7000-8000-0000000000b3')
  const own = silence(first, 'app:cursor')
  const others = silence(second, 'app:cursor')

  first.emit('app:cursor', 1, 2)
  first.emit('app:cursor', '1', 2)
  first.emit('app:cursor', 1)
  first.emit('app:cursor', Number.NaN, 2)
  first.emit('app:cursor', { x: 1, y: 2 })

  assert.equal((await own).length, 0)
  assert.equal((await others).length, 1)
})

test('only those who joined send pointers, and only their room hears them', async () => {
  const room = '019b0000-0000-7000-8000-0000000000b4'
  const listener = connect(TENANT, { token: token({ room, name: 'Listener' }) })
  await join(listener)
  // Connected but never said hello
  const stranger = connect(TENANT, { token: token({ room, name: 'Silent' }) })
  await new Promise<void>(resolve => stranger.on('connect', () => resolve()))
  const apart = connect(TENANT, { token: token({ room: '019b0000-0000-7000-8000-0000000000b5' }) })
  await join(apart)
  const inRoom = silence(listener, 'app:cursor')
  const elsewhere = silence(apart, 'app:cursor')

  stranger.emit('app:cursor', 1, 2)

  assert.equal((await inRoom).length, 0)
  assert.equal((await elsewhere).length, 0)
})

test('the others hear when a pointer leaves the drawing', async () => {
  const { first, second, firstAck } = await pair('019b0000-0000-7000-8000-0000000000b6')

  const gone = once<string>(second, 'app:cursor-gone')
  first.emit('app:cursor-gone')

  assert.equal(await gone, firstAck.user.id)
})

test('a selection reaches the others with the sender the server knows, an empty one too', async () => {
  const { first, second, firstAck } = await pair('019b0000-0000-7000-8000-0000000000b7')
  const hear = () => new Promise<unknown[]>(resolve => second.once('app:selection', (...args: unknown[]) => resolve(args)))

  let heard = hear()
  first.emit('app:selection', ['a', 'b'])
  assert.deepEqual(await heard, [firstAck.user.id, ['a', 'b']])

  heard = hear()
  first.emit('app:selection', [])
  assert.deepEqual(await heard, [firstAck.user.id, []])
})

test('what is no list of ids, or too long a one, is dropped', async () => {
  const { first, second } = await pair('019b0000-0000-7000-8000-0000000000b8')
  const own = silence(first, 'app:selection')
  const others = silence(second, 'app:selection')

  first.emit('app:selection', ['a'])
  first.emit('app:selection', 'a')
  first.emit('app:selection', [1])
  first.emit('app:selection', [''])
  first.emit('app:selection', ['x'.repeat(SELECTION_ID_LENGTH + 1)])
  first.emit('app:selection', Array.from({ length: SELECTION_LIMIT + 1 }, (_, index) => `e${index}`))

  assert.equal((await own).length, 0)
  assert.equal((await others).length, 1)
})

const PATCH = {
  planId: 'plan',
  vertices: [{ id: 'v', x: 1, y: 2 }],
  removedVertexIds: [],
  elements: [],
  removedElementIds: ['e'],
  groups: [],
  removedGroupIds: [],
  layers: [],
  removedLayerIds: [],
  styles: [],
  removedStyleIds: [],
  changedElementIds: ['e'],
}

test('a change reaches the others as it was sent, with the author the server knows', async () => {
  const { first, second, firstAck } = await pair('019b0000-0000-7000-8000-0000000000b9')

  const heard = new Promise<unknown[]>(resolve => second.once('app:change', (...args: unknown[]) => resolve(args)))
  // An author named by the client counts for nothing
  first.emit('app:change', { ...PATCH, userId: 'somebody-else' })
  const [userId, patch] = await heard

  assert.equal(userId, firstAck.user.id)
  assert.deepEqual(patch, { ...PATCH, userId: 'somebody-else' })
})

test('changes arrive in the order they were sent', async () => {
  const { first, second } = await pair('019b0000-0000-7000-8000-0000000000ba')
  const plans: string[] = []
  const done = new Promise<void>(resolve =>
    second.on('app:change', (_userId: string, patch: { planId: string }) => {
      plans.push(patch.planId)
      if (plans.length === 3) resolve()
    }),
  )

  for (const planId of ['1', '2', '3']) first.emit('app:change', { ...PATCH, planId })
  await done

  assert.deepEqual(plans, ['1', '2', '3'])
})

test('what is no patch, or too large a one, is dropped, and the sender hears nothing of its own', async () => {
  const { first, second } = await pair('019b0000-0000-7000-8000-0000000000bb')
  const own = silence(first, 'app:change')
  const others = silence(second, 'app:change')

  first.emit('app:change', PATCH)
  first.emit('app:change', 'patch')
  first.emit('app:change', [PATCH])
  first.emit('app:change', { ...PATCH, planId: 1 })
  first.emit('app:change', { ...PATCH, vertices: undefined })
  first.emit('app:change', { ...PATCH, removedElementIds: Array.from({ length: CHANGE_LIMIT }, () => 'e') })

  assert.equal((await own).length, 0)
  assert.equal((await others).length, 1)
})
