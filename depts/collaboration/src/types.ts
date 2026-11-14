/**
 * What travels over the socket. The editor declares the same shapes by hand in
 * `depts/editor/src/collaboration/types.ts`: there is deliberately no codegen and no shared
 * package, as this server never looks inside what a client sends.
 */

/** One person in a room. The id is minted here, never taken from a client. */
export interface Collaborator {
  id: string
  name: string
  image: string | null
}

export interface JoinAck {
  /** How many are in the room, the asking client included. */
  clients: number
  /** Who the asking client turned out to be — its assigned id included. */
  user: Collaborator
  /** Everybody in the room, the asking client included (`me: true`). */
  users: (Collaborator & { me: boolean })[]
}

/**
 * The `data` of the `connect_error` a full room refuses a socket with — not an event of its own,
 * since the socket never got far enough to receive one.
 */
export interface RoomFull {
  code: 'room-full'
  limit: number
  /** Who is in the room. Somebody still connecting is counted but not listed. */
  users: Collaborator[]
}

export interface JoinedMessage {
  clients: number
  user: Collaborator
}

export interface LeftMessage {
  clients: number
  userId: string
}

export const EVENTS = {
  join: 'app:join',
  joined: 'app:joined',
  left: 'app:left',
} as const
