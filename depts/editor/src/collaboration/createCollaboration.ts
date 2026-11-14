import { io } from 'socket.io-client';
import type { ApiSchema } from 'app/api/types';
import { patchSize, type DocumentPatch } from 'app/cad/editor/commands/DocumentPatch';
import type { Point } from 'app/cad/model/Point';
import { CHANGE_LIMIT, EVENTS, SELECTION_LIMIT } from './types';
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
    /** Emits only if the connection can take it right now, and never queues it for later. */
    readonly volatile: { emit(event: string, ...args: unknown[]): unknown };
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

/** Another collaborator's pointer: who, and where in model coordinates. */
export interface RemoteCursor {
    user: Collaborator;
    point: Point;
}

/**
 * The pointers: what the canvas shows of the others and what it tells them of its own. Apart from
 * the state because it changes up to {@link CURSOR_INTERVAL_MS} apart per person, which must not
 * render the editor's UI each time.
 */
export interface CursorChannel {
    /**
     * This pointer's position, or null once it left the drawing. Throttled, and only sent while
     * somebody else is in the room, so calling it on every move is fine.
     */
    sendCursor(point: Point | null): void;
    getCursors(): readonly RemoteCursor[];
    subscribeCursors(listener: () => void): () => void;
}

/** What another collaborator has selected or is editing; never empty. */
export interface RemoteSelection {
    user: Collaborator;
    ids: readonly string[];
}

/**
 * The selections: which elements the others hold, and which this editor tells them it holds. An
 * element two picked at the same moment stays with the smaller collaborator id: for that one it is
 * left out of the other's selection here, the other finds it in `getSelections` and lets go.
 */
export interface SelectionChannel {
    /** The elements selected or edited here, all of them each time; only sent when they changed. */
    sendSelection(ids: Iterable<string>): void;
    getSelections(): readonly RemoteSelection[];
    subscribeSelections(listener: () => void): () => void;
}

/**
 * The changes of the document: what was done here goes to the others, what they did comes in with
 * the id of who did it (given by the server). Events, not state: each is applied once.
 */
export interface ChangeChannel {
    /**
     * Sends a change made here, unless nobody else is in the room. One that names more than
     * CHANGE_LIMIT things is not sent (and a warning logged): the server would refuse it.
     */
    sendChange(patch: DocumentPatch): void;
    subscribeChanges(listener: (patch: DocumentPatch, userId: string) => void): () => void;
}

/** What the canvas shares with the room and shows of it. */
export type PresenceChannel = CursorChannel & SelectionChannel & ChangeChannel;

export interface Collaboration extends PresenceChannel {
    getState(): CollaborationState;
    subscribe(listener: () => void): () => void;
    close(): void;
}

/** At most one position per this many ms: 20 a second is smooth enough for a pointer to follow. */
export const CURSOR_INTERVAL_MS = 50;
/** Positions are sent rounded to this many decimals of a mm: a pixel even at the highest zoom. */
const CURSOR_DECIMALS = 3;

const INITIAL: CollaborationState = { status: 'connecting', users: [], me: null, limit: null };

const rounded = (value: number) => Math.round(value * 10 ** CURSOR_DECIMALS) / 10 ** CURSOR_DECIMALS;

function sameList(a: readonly string[], b: readonly string[]): boolean {
    return a === b || (a.length === b.length && a.every((id, index) => id === b[index]));
}

function samePoint(a: Point | null | undefined, b: Point | null | undefined): boolean {
    return a === b || (!!a && !!b && a.x === b.x && a.y === b.y);
}

/**
 * Logs this editor in to the room of its project. One object shaped like a store (`getState`,
 * `subscribe`), so React reads it with `useSyncExternalStore`. It knows who is there, where
 * their pointers are and what they selected; the commands will travel over the same socket later, as reliable messages
 * of their own: the pointers are sent `volatile`, which a reliable message queued before them
 * would make the socket drop.
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
    const cursorListeners = new Set<() => void>();
    /** Where the others' pointers are, by collaborator id. */
    let pointers = new Map<string, Point>();
    let cursors: readonly RemoteCursor[] = [];
    /** The latest position asked for (null: left the drawing), what the others last got, and when. */
    let wanted: Point | null | undefined;
    let sent: Point | null | undefined;
    let sentAt = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const selectionListeners = new Set<() => void>();
    const changeListeners = new Set<(patch: DocumentPatch, userId: string) => void>();
    /** What each of the others says it selected, by collaborator id. */
    const claims = new Map<string, readonly string[]>();
    let selections: readonly RemoteSelection[] = [];
    /** The selection here, and what the others last got of it (undefined: nothing yet). */
    let mine: readonly string[] = [];
    let mineSet: ReadonlySet<string> = new Set();
    let sentSelection: readonly string[] | undefined;

    const set = (patch: Partial<CollaborationState>) => {
        state = { ...state, ...patch };
        listeners.forEach((listener) => listener());
    };

    const setPointers = (next: Map<string, Point>) => {
        pointers = next;
        cursors = state.users.flatMap((user) => {
            const point = pointers.get(user.id);
            return point && user.id !== state.me?.id ? [{ user, point }] : [];
        });
        cursorListeners.forEach((listener) => listener());
    };

    const withoutPointer = (userId: string) => {
        if (pointers.has(userId)) {
            const next = new Map(pointers);
            next.delete(userId);
            setPointers(next);
        }
    };

    /** The others' selections without what this client keeps of an element picked by both. */
    const refreshSelections = () => {
        const me = state.me;
        const next = state.users.flatMap((user) => {
            const claimed = claims.get(user.id);
            if (!claimed || !me || user.id === me.id) {
                return [];
            }
            const ids = me.id < user.id ? claimed.filter((id) => !mineSet.has(id)) : claimed;
            return ids.length > 0 ? [{ user, ids }] : [];
        });
        const same =
            next.length === selections.length &&
            next.every(({ user, ids }, index) => user === selections[index].user && sameList(ids, selections[index].ids));
        if (!same) {
            selections = next;
            selectionListeners.forEach((listener) => listener());
        }
    };

    const socket = connect(access, refreshToken);

    /** Nobody to show it to means nothing to send. */
    const listening = () => state.status === 'connected' && state.users.length > 1;

    const flush = () => {
        timer = null;
        if (wanted === undefined || !listening() || samePoint(wanted, sent)) {
            return;
        }
        sent = wanted;
        sentAt = Date.now();
        if (wanted) {
            socket.volatile.emit(EVENTS.cursor, rounded(wanted.x), rounded(wanted.y));
        } else {
            socket.emit(EVENTS.cursorGone);
        }
    };

    /** Reliable and at once: a selection changes with a click, not with every move. */
    const flushSelection = () => {
        if (!listening() || (sentSelection !== undefined && sameList(sentSelection, mine))) {
            return;
        }
        // Somebody new takes an empty selection for granted
        if (sentSelection !== undefined || mine.length > 0) {
            socket.emit(EVENTS.selection, mine);
        }
        sentSelection = mine;
    };

    const schedule = () => {
        if (timer !== null) {
            return;
        }
        const wait = sentAt + CURSOR_INTERVAL_MS - Date.now();
        if (wait <= 0) {
            flush();
        } else {
            timer = setTimeout(flush, wait);
        }
    };

    socket.on('connect', () => {
        // A new connection knows nothing of this client's pointer yet
        sent = undefined;
        sentSelection = undefined;
        socket.emit(EVENTS.join, (ack: JoinAck) => {
            answered = true;
            set({ status: 'connected', users: ack.users, me: ack.user, limit: null });
            schedule();
            flushSelection();
        });
    });
    socket.on(EVENTS.joined, ((message: JoinedMessage) => {
        if (!state.users.some((user) => user.id === message.user.id)) {
            set({ users: [...state.users, message.user] });
            // The newcomer sees this pointer at once rather than with its next move
            sent = undefined;
            schedule();
            // And learns the selection, which the server does not keep
            sentSelection = undefined;
            flushSelection();
            refreshSelections();
        }
    }) as never);
    socket.on(EVENTS.left, ((message: LeftMessage) => {
        set({ users: state.users.filter((user) => user.id !== message.userId) });
        withoutPointer(message.userId);
        claims.delete(message.userId);
        refreshSelections();
    }) as never);
    socket.on(EVENTS.selection, ((userId: string, ids: readonly string[]) => {
        claims.set(userId, ids);
        refreshSelections();
    }) as never);
    socket.on(EVENTS.cursor, ((userId: string, x: number, y: number) => {
        setPointers(new Map(pointers).set(userId, { x, y }));
    }) as never);
    socket.on(EVENTS.cursorGone, ((userId: string) => withoutPointer(userId)) as never);
    socket.on(EVENTS.change, ((userId: string, patch: DocumentPatch) => {
        // The server never sends a change back to who made it; this only makes sure of it
        if (userId !== state.me?.id) {
            changeListeners.forEach((listener) => listener(patch, userId));
        }
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
        setPointers(new Map());
        claims.clear();
        refreshSelections();
    });

    return {
        getState: () => state,
        subscribe: (listener) => {
            listeners.add(listener);
            return () => listeners.delete(listener);
        },
        sendCursor: (point) => {
            wanted = point;
            schedule();
        },
        getCursors: () => cursors,
        subscribeCursors: (listener) => {
            cursorListeners.add(listener);
            return () => cursorListeners.delete(listener);
        },
        sendSelection: (ids) => {
            const next = [...ids].slice(0, SELECTION_LIMIT);
            if (sameList(next, mine)) {
                return;
            }
            mine = next;
            mineSet = new Set(next);
            flushSelection();
            refreshSelections();
        },
        getSelections: () => selections,
        subscribeSelections: (listener) => {
            selectionListeners.add(listener);
            return () => selectionListeners.delete(listener);
        },
        sendChange: (patch) => {
            if (!listening()) {
                return;
            }
            if (patchSize(patch) > CHANGE_LIMIT) {
                console.warn('[collaboration] A change was too large to send; the others no longer see this drawing as it is.');
                return;
            }
            socket.emit(EVENTS.change, patch);
        },
        subscribeChanges: (listener) => {
            changeListeners.add(listener);
            return () => changeListeners.delete(listener);
        },
        close: () => {
            changeListeners.clear();
            listeners.clear();
            cursorListeners.clear();
            selectionListeners.clear();
            if (timer !== null) {
                clearTimeout(timer);
            }
            socket.close();
        },
    };
}
