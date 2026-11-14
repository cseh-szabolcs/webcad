import { io } from 'socket.io-client';
import type { ApiSchema } from 'app/api/types';
import { EVENTS } from './types';
import type { Collaborator, JoinAck, JoinedMessage, LeftMessage, RoomFull } from './types';

export type CollaborationAccess = ApiSchema['CollaborationAccess'];

/**
 * `connecting` until the server answered once; `connected` in the room; `full` when the room
 * admits nobody else (`limit`); `offline` for any other trouble. Only the first answer decides
 * between connected and full: the editor stays usable in every state, as a plan without
 * collaboration is one.
 */
export type CollaborationStatus = 'connecting' | 'connected' | 'full' | 'offline';

export interface CollaborationState {
    status: CollaborationStatus;
    /** Everybody in the room, this client included. Empty until joined. */
    users: readonly Collaborator[];
    /** Who this client is, once joined. */
    me: Collaborator | null;
    /** The room's limit, when `full`. */
    limit: number | null;
}

/** The part of a Socket.IO client used here, so tests can stand in for it. */
export interface CollaborationSocket {
    on(event: string, listener: (...args: never[]) => void): unknown;
    emit(event: string, ...args: unknown[]): unknown;
    close(): unknown;
}

/** Asks the backend for a new token; a token only lives long enough for one handshake. */
export type RefreshToken = () => Promise<string>;

export type Connect = (access: CollaborationAccess, refreshToken: RefreshToken) => CollaborationSocket;

/**
 * Same origin as the editor: the dev server (and later the web server) forwards `/socket.io`.
 * The namespace is the tenant, the token (signed by the backend) says which room. The token that
 * came with the access serves the first handshake; every reconnect asks for a fresh one.
 */
export const connectSocket: Connect = (access, refreshToken) => {
    let first = true;
    return io(`/${access.namespace}`, {
        reconnection: true,
        auth: (callback) => {
            if (first) {
                first = false;
                callback({ token: access.token });
                return;
            }
            refreshToken().then(
                (token) => callback({ token }),
                () => callback({ token: access.token }),
            );
        },
    });
};

export interface Collaboration {
    getState(): CollaborationState;
    subscribe(listener: () => void): () => void;
    close(): void;
}

const INITIAL: CollaborationState = { status: 'connecting', users: [], me: null, limit: null };

/**
 * Logs this editor in to the room of its project. One object shaped like a store (`getState`,
 * `subscribe`), so React reads it with `useSyncExternalStore`. For now it only knows who is there;
 * the commands will travel over the same socket later.
 */
export function createCollaboration(
    access: CollaborationAccess,
    refreshToken: RefreshToken,
    connect: Connect = connectSocket,
): Collaboration {
    let state: CollaborationState = INITIAL;
    // The first answer decides: a reconnect that finds its place taken must not unmount the work
    let answered = false;
    const listeners = new Set<() => void>();

    const set = (patch: Partial<CollaborationState>) => {
        state = { ...state, ...patch };
        listeners.forEach((listener) => listener());
    };

    const socket = connect(access, refreshToken);

    socket.on('connect', () => {
        socket.emit(EVENTS.join, (ack: JoinAck) => {
            answered = true;
            set({ status: 'connected', users: ack.users, me: ack.user, limit: null });
        });
    });
    socket.on(EVENTS.joined, ((message: JoinedMessage) => {
        if (!state.users.some((user) => user.id === message.user.id)) {
            set({ users: [...state.users, message.user] });
        }
    }) as never);
    socket.on(EVENTS.left, ((message: LeftMessage) => {
        set({ users: state.users.filter((user) => user.id !== message.userId) });
    }) as never);
    socket.on('connect_error', ((error: Error & { data?: RoomFull }) => {
        if (error.data?.code === 'room-full' && !answered) {
            answered = true;
            set({ status: 'full', users: error.data.users, limit: error.data.limit });
        } else if (!answered) {
            answered = true;
            set({ status: 'offline' });
        }
    }) as never);
    socket.on('disconnect', () => {
        // Whoever was here is not known any more; socket.io-client reconnects by itself
        set({ status: 'offline', users: [], me: null });
    });

    return {
        getState: () => state,
        subscribe: (listener) => {
            listeners.add(listener);
            return () => listeners.delete(listener);
        },
        close: () => {
            listeners.clear();
            socket.close();
        },
    };
}
