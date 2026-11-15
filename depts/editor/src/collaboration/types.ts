/**
 * What travels over the socket. The collaboration server declares the same shapes by hand in
 * `depts/collaboration/src/types.ts`: there is deliberately no codegen and no shared package.
 */

/** One person in a room. The id is minted by the server. */
export interface Collaborator {
    id: string;
    name: string;
    image: string | null;
    /** Index into the palette of five colours (`--collab-color-*`); the server hands out free ones first. */
    color: number;
}

/** How many colours there are; the server's `COLLABORATOR_COLORS`. */
export const COLLABORATOR_COLORS = 5;

export interface JoinAck {
    clients: number;
    user: Collaborator;
    /** Everybody in the room, this client included (`me: true`). */
    users: (Collaborator & { me: boolean })[];
}

/** The `data` of the `connect_error` a full room refuses a socket with. */
export interface RoomFull {
    code: 'room-full';
    limit: number;
    users: Collaborator[];
}

export interface JoinedMessage {
    clients: number;
    user: Collaborator;
}

export interface LeftMessage {
    clients: number;
    userId: string;
}

export const EVENTS = {
    join: 'app:join',
    joined: 'app:joined',
    left: 'app:left',
    /**
     * Where a pointer is, in model coordinates. To the server `(x, y)`, from it `(userId, x, y)`.
     * Sent `volatile`: a lost position is replaced by the next, and it never shares a packet with
     * a command (a volatile message queued behind a reliable one is dropped).
     */
    cursor: 'app:cursor',
    /** The pointer left the drawing. To the server nothing, from it `(userId)`. Reliable. */
    cursorGone: 'app:cursor-gone',
    /**
     * The elements a collaborator has selected or is editing, all of them each time. To the server
     * `(ids)`, from it `(userId, ids)`. Reliable; sent again when somebody joins, as the server
     * stores nothing.
     */
    selection: 'app:selection',
    /**
     * A change of the document (see `DocumentPatch`). To the server `(patch)`, from it
     * `(userId, patch)`: the server says who made it, never the client. Reliable and in order.
     */
    change: 'app:change',
} as const;

/** The most vertices, elements, groups, layers and styles one `app:change` may name; the server's `CHANGE_LIMIT`. */
export const CHANGE_LIMIT = 20000;

/** The most element ids one `app:selection` may carry; the server's `SELECTION_LIMIT`. */
export const SELECTION_LIMIT = 5000;
