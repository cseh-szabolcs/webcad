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
  /** Index into the palette of {@link COLLABORATOR_COLORS} colours; free ones are handed out first. */
  color: number
}

/** How many colours there are to tell collaborators apart; a room beyond it repeats them. */
export const COLLABORATOR_COLORS = 5

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
  /**
   * Where a collaborator's pointer is, in model coordinates. Client → server: `(x, y)`; server →
   * room: `(userId, x, y)`. Never acknowledged and sent `volatile`, so a lost one is replaced by
   * the next.
   */
  cursor: 'app:cursor',
  /** The pointer left the drawing. Client → server: nothing; server → room: `(userId)`. Reliable. */
  cursorGone: 'app:cursor-gone',
  /**
   * The elements a collaborator has selected or is editing, all of them each time (none: an empty
   * list). Client → server: `(ids)`; server → room: `(userId, ids)`. Reliable. Nothing is stored:
   * everybody sends theirs again when somebody joins.
   */
  selection: 'app:selection',
} as const

/** The most element ids one `app:selection` may carry; a longer list is ignored. */
export const SELECTION_LIMIT = 5000
/** The longest element id taken (a uuid has 36 characters). */
export const SELECTION_ID_LENGTH = 64
