import { createServer } from 'node:http'
import type { Server as HttpServer } from 'node:http'
import { Server } from 'socket.io'
import type { Namespace, Socket } from 'socket.io'
import { nanoid } from 'nanoid'
import { isGranted } from './isGranted.ts'
import { EVENTS } from './types.ts'
import type { Collaborator, JoinAck, RoomFull } from './types.ts'

export interface SocketServerOptions {
  /** Port to listen on; 0 picks a free one (tests). */
  port: number
  /** Which browser origin may open a socket; empty = same origin only (the dev proxy). */
  allowedOrigin?: string
  /** How many sockets one room admits at once. */
  maxClientsPerRoom: number
  /** Shared with the backend, which signs the tokens. */
  secret: string | undefined
  log?: boolean
}

/** What this server knows about one connected socket. */
interface SocketState {
  socketId: string
  namespace: string
  room: string
  user: Collaborator
  joined: boolean
}

/** One namespace per tenant: its uuid. */
const TENANT_NAMESPACE = /^\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * One namespace per tenant, one room per project, and nothing in it but presence for now.
 *
 * The server is stateless about the document: it never applies, stores or validates an edit.
 * Two things are decided here rather than by a client: the collaborator id (`nanoid`), so nobody
 * can claim to be somebody else, and the room, taken from the signed token that {@link isGranted}
 * approved rather than from a later message.
 */
export default class SocketServer {
  public readonly io: Server

  private readonly http: HttpServer
  private readonly log: boolean
  private readonly maxClientsPerRoom: number
  private readonly secret: string | undefined
  /** Per-socket state, keyed by namespace and socket id. Not `socket.data`. */
  private readonly state = new Map<string, SocketState>()

  constructor({ port, allowedOrigin, maxClientsPerRoom, secret, log = false }: SocketServerOptions) {
    this.log = log
    this.maxClientsPerRoom = maxClientsPerRoom
    this.secret = secret
    this.http = createServer()
    this.io = new Server(this.http, {
      cors: allowedOrigin ? { origin: allowedOrigin, credentials: false } : undefined,
    })
    this.http.listen(port)
  }

  /** The port actually listening (useful with port 0). */
  public get port(): number {
    const address = this.http.address()
    return typeof address === 'object' && address ? address.port : 0
  }

  public listen(): Namespace {
    const namespaces = this.io.of(TENANT_NAMESPACE)

    namespaces.use((socket, next) => {
      const grant = isGranted(socket, this.secret)

      if (grant instanceof Error) {
        this.print(`Refused ${socket.id} in ${socket.nsp.name}: ${grant.message}`)
        next(grant)
        return
      }

      const occupants = this.occupants(grant.namespace, grant.room)
      if (occupants.length >= this.maxClientsPerRoom) {
        this.print(`Refused ${socket.id}: room ${grant.room} is full`)
        next(roomFull(this.maxClientsPerRoom, occupants))
        return
      }

      this.state.set(key(socket), {
        socketId: socket.id,
        namespace: grant.namespace,
        room: grant.room,
        user: { id: nanoid(8), name: grant.name, image: null },
        joined: false,
      })
      next()
    })

    namespaces.on('connection', socket => this.initialize(socket))

    return namespaces
  }

  public close(): Promise<void> {
    return new Promise(resolve => {
      void this.io.close(() => resolve())
    })
  }

  private initialize(socket: Socket): void {
    const state = this.state.get(key(socket))

    if (!state) {
      socket.disconnect()
      return
    }

    this.print(`${state.user.name} (${socket.id}) connected to room ${state.room}`)

    socket.on(EVENTS.join, (ack?: (data: JoinAck) => void) => this.join(socket, ack))
    // Fires while the socket is still in its rooms, which is what lets the room be told how many
    // are left rather than how many there were.
    socket.on('disconnecting', () => this.leave(socket))
  }

  /**
   * Joining is a step of its own, as in the reference: the room only counts those who said hello,
   * and a client that wants to be told who is there asks with an acknowledgement.
   */
  private join(socket: Socket, ack?: (data: JoinAck) => void): void {
    const state = this.state.get(key(socket))
    if (!state) return

    if (!state.joined) {
      state.joined = true
      void socket.join(state.room)

      socket.to(state.room).emit(EVENTS.joined, {
        clients: this.joined(state.namespace, state.room).length,
        user: state.user,
      })
    }

    const peers = this.joined(state.namespace, state.room)

    if (typeof ack === 'function') {
      ack({
        clients: peers.length,
        user: state.user,
        users: peers.map(({ user, id }): JoinAck['users'][number] => ({ ...user, me: id === socket.id })),
      })
    }

    this.print(`${state.user.name} (${state.user.id}) joined room ${state.room}`)
  }

  private leave(socket: Socket): void {
    const state = this.state.get(key(socket))
    this.state.delete(key(socket))
    if (!state?.joined) return

    // The state is already gone, so the count no longer includes this socket.
    socket.to(state.room).emit(EVENTS.left, {
      clients: this.joined(state.namespace, state.room).length,
      userId: state.user.id,
    })

    this.print(`${state.user.name} (${state.user.id}) left room ${state.room}`)
  }

  /**
   * Every socket let in for this room, joined or not: a socket only says hello after it
   * connected, so two arriving together would both see a room with space left.
   */
  private occupants(namespace: string, room: string): SocketState[] {
    return [...this.state.values()].filter(
      candidate => candidate.namespace === namespace && candidate.room === room,
    )
  }

  private joined(namespace: string, room: string): { id: string; user: Collaborator }[] {
    return this.occupants(namespace, room)
      .filter(({ joined }) => joined)
      .map(({ socketId, user }) => ({ id: socketId, user }))
  }

  private print(message: string): void {
    if (this.log) console.log(`[collaboration] ${message}`)
  }
}

/** Socket ids are only unique within a namespace. */
function key(socket: Socket): string {
  return `${socket.nsp.name}#${socket.id}`
}

/**
 * Refused in the handshake, so the client sees a `connect_error` and does not retry on its own.
 * `data.code` tells it apart from a bad token; `data.users` is who is in the way.
 */
function roomFull(limit: number, occupants: SocketState[]): Error & { data: RoomFull } {
  return Object.assign(new Error(`The room is full (${limit} clients).`), {
    data: {
      code: 'room-full' as const,
      limit,
      users: occupants.filter(({ joined }) => joined).map(({ user }) => user),
    },
  })
}
