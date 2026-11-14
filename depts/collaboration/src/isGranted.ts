import type { Socket } from 'socket.io'
import { verifyToken } from './token.ts'

export interface Grant {
  /** The tenant's uuid, which is the namespace the socket asked for. */
  namespace: string
  /** The project's id: the one room this socket may reach. */
  room: string
  /** Who the backend says this is. */
  name: string
}

/**
 * The handshake. The client shows the token the backend signed for it; the namespace it connected
 * to has to be the one the token names, so a token for one tenant is worth nothing in another.
 * Nothing else about the client is trusted: the room comes from the token and the collaborator id
 * is minted by {@link SocketServer}.
 *
 * **This is the seam for the authentication:** nothing else has to change if it moves elsewhere.
 */
export function isGranted(socket: Socket, secret: string | undefined): Grant | Error {
  if (!secret) return new Error('The server has no COLLAB_AUTH_TOKEN configured.')

  const auth = (socket.handshake.auth ?? {}) as { token?: unknown }
  const payload = verifyToken(auth.token, secret)
  if (payload instanceof Error) return payload

  if (socket.nsp.name !== `/${payload.ns}`) return new Error('The token is for another namespace.')

  return { namespace: payload.ns, room: payload.room, name: payload.name }
}
