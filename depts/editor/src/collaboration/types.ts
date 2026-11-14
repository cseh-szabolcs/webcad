/**
 * What travels over the socket. The collaboration server declares the same shapes by hand in
 * `depts/collaboration/src/types.ts`: there is deliberately no codegen and no shared package.
 */

/** One person in a room. The id is minted by the server. */
export interface Collaborator {
    id: string;
    name: string;
    image: string | null;
}

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
} as const;
