import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    createCollaboration,
    CURSOR_INTERVAL_MS,
    type CollaborationAccess,
    type CollaborationSocket,
} from './createCollaboration';
import type { Collaborator, JoinAck } from './types';

const ACCESS: CollaborationAccess = { namespace: 'tenant', room: 'project', userName: 'Erika', token: 'token' };
const ERIKA: Collaborator = { id: 'e1', name: 'Erika', image: null, color: 0 };
const MAX: Collaborator = { id: 'm1', name: 'Max', image: null, color: 1 };

/** A socket the test drives by hand: `trigger` fires the listeners of an event. */
function fakeSocket() {
    const listeners = new Map<string, ((...args: never[]) => void)[]>();
    const emit = vi.fn<(event: string, ...args: unknown[]) => void>();
    const close = vi.fn();
    const volatileEmit = vi.fn<(event: string, ...args: unknown[]) => void>();
    const socket: CollaborationSocket = {
        on: (event, listener) => void listeners.set(event, [...(listeners.get(event) ?? []), listener]),
        emit,
        volatile: { emit: volatileEmit },
        close,
    };
    return {
        socket,
        emit,
        volatileEmit,
        close,
        trigger: (event: string, ...args: unknown[]) => listeners.get(event)?.forEach((listener) => listener(...(args as never[]))),
    };
}

function setup() {
    const fake = fakeSocket();
    const connect = vi.fn(() => fake.socket);
    const collaboration = createCollaboration(ACCESS, async () => 'fresh', connect);
    return { ...fake, collaboration, connect };
}

/** The server's answer to `app:join`. */
function answerJoin(emit: ReturnType<typeof fakeSocket>['emit'], ack: JoinAck) {
    const callback = emit.mock.calls.find(([event]) => event === 'app:join')?.[1] as (data: JoinAck) => void;
    callback(ack);
}

describe('createCollaboration', () => {
    it('connects with the access it was given', () => {
        const { connect, collaboration } = setup();

        expect(connect).toHaveBeenCalledWith(ACCESS, expect.any(Function));
        expect(collaboration.getState()).toMatchObject({ status: 'connecting', users: [] });
    });

    it('joins the room once connected and knows who is there', () => {
        const { trigger, emit, collaboration } = setup();

        trigger('connect');
        answerJoin(emit, { clients: 2, user: ERIKA, users: [{ ...MAX, me: false }, { ...ERIKA, me: true }] });

        expect(collaboration.getState()).toMatchObject({ status: 'connected', me: ERIKA });
        expect(collaboration.getState().users.map((user) => user.name)).toEqual(['Max', 'Erika']);
    });

    it('follows who joins and who leaves, and notifies its subscribers', () => {
        const { trigger, emit, collaboration } = setup();
        const listener = vi.fn();
        trigger('connect');
        answerJoin(emit, { clients: 1, user: ERIKA, users: [{ ...ERIKA, me: true }] });
        collaboration.subscribe(listener);

        trigger('app:joined', { clients: 2, user: MAX });
        trigger('app:joined', { clients: 2, user: MAX });
        expect(collaboration.getState().users.map((user) => user.id)).toEqual(['e1', 'm1']);

        trigger('app:left', { clients: 1, userId: 'm1' });
        expect(collaboration.getState().users.map((user) => user.id)).toEqual(['e1']);
        expect(listener).toHaveBeenCalledTimes(2);
    });

    it('reports a full room with its limit and who is in it', () => {
        const { trigger, collaboration } = setup();

        trigger('connect_error', Object.assign(new Error('full'), { data: { code: 'room-full', limit: 5, users: [MAX] } }));

        expect(collaboration.getState()).toMatchObject({ status: 'full', limit: 5, users: [MAX] });
    });

    it('is offline for any other refusal', () => {
        const { trigger, collaboration } = setup();

        trigger('connect_error', new Error('Invalid token provided.'));

        expect(collaboration.getState().status).toBe('offline');
    });

    it('goes offline when the connection drops and back when it returns', () => {
        const { trigger, emit, collaboration } = setup();
        trigger('connect');
        answerJoin(emit, { clients: 1, user: ERIKA, users: [{ ...ERIKA, me: true }] });

        trigger('disconnect');
        expect(collaboration.getState()).toMatchObject({ status: 'offline', users: [], me: null });

        trigger('connect');
        answerJoin(emit, { clients: 1, user: ERIKA, users: [{ ...ERIKA, me: true }] });
        expect(collaboration.getState().status).toBe('connected');
    });

    it('does not let a refused reconnect replace what the first answer decided', () => {
        const { trigger, emit, collaboration } = setup();
        trigger('connect');
        answerJoin(emit, { clients: 1, user: ERIKA, users: [{ ...ERIKA, me: true }] });
        trigger('disconnect');

        trigger('connect_error', Object.assign(new Error('full'), { data: { code: 'room-full', limit: 5, users: [] } }));

        expect(collaboration.getState().status).toBe('offline');
    });

    it('closes the socket and stops notifying', () => {
        const { close, trigger, collaboration } = setup();
        const listener = vi.fn();
        collaboration.subscribe(listener);

        collaboration.close();
        trigger('connect_error', new Error('late'));

        expect(close).toHaveBeenCalled();
        expect(listener).not.toHaveBeenCalled();
    });
});

describe('pointers', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });
    afterEach(() => {
        vi.useRealTimers();
    });

    /** Joined to a room with Max in it, unless alone. */
    function joined(alone = false) {
        const context = setup();
        context.trigger('connect');
        answerJoin(context.emit, {
            clients: alone ? 1 : 2,
            user: ERIKA,
            users: alone ? [{ ...ERIKA, me: true }] : [{ ...MAX, me: false }, { ...ERIKA, me: true }],
        });
        return context;
    }

    it('sends the position volatile, rounded to a thousandth of a mm, and not twice the same', () => {
        const { collaboration, volatileEmit, emit } = joined();

        collaboration.sendCursor({ x: 12.34567, y: -0.0004 });
        vi.advanceTimersByTime(CURSOR_INTERVAL_MS);
        collaboration.sendCursor({ x: 12.34567, y: -0.0004 });
        vi.advanceTimersByTime(CURSOR_INTERVAL_MS);

        expect(volatileEmit.mock.calls).toEqual([['app:cursor', 12.346, -0]]);
        // Never through the reliable path
        expect(emit.mock.calls.filter(([event]) => event === 'app:cursor')).toEqual([]);
    });

    it('sends at most one position per interval, and the last one wins', () => {
        const { collaboration, volatileEmit } = joined();

        collaboration.sendCursor({ x: 1, y: 1 });
        collaboration.sendCursor({ x: 2, y: 2 });
        collaboration.sendCursor({ x: 3, y: 3 });
        expect(volatileEmit.mock.calls).toEqual([['app:cursor', 1, 1]]);

        vi.advanceTimersByTime(CURSOR_INTERVAL_MS);
        expect(volatileEmit.mock.calls).toEqual([
            ['app:cursor', 1, 1],
            ['app:cursor', 3, 3],
        ]);
    });

    it('sends nothing while alone in the room, and the position as soon as somebody comes', () => {
        const { collaboration, volatileEmit, trigger } = joined(true);

        collaboration.sendCursor({ x: 5, y: 6 });
        vi.advanceTimersByTime(CURSOR_INTERVAL_MS * 4);
        expect(volatileEmit).not.toHaveBeenCalled();

        trigger('app:joined', { clients: 2, user: MAX });
        expect(volatileEmit.mock.calls).toEqual([['app:cursor', 5, 6]]);
    });

    it('sends nothing before it has joined', () => {
        const { collaboration, volatileEmit } = setup();

        collaboration.sendCursor({ x: 1, y: 1 });
        vi.advanceTimersByTime(CURSOR_INTERVAL_MS * 4);

        expect(volatileEmit).not.toHaveBeenCalled();
    });

    it('tells the others reliably when the pointer leaves the drawing', () => {
        const { collaboration, volatileEmit, emit } = joined();

        collaboration.sendCursor({ x: 1, y: 1 });
        vi.advanceTimersByTime(CURSOR_INTERVAL_MS);
        collaboration.sendCursor(null);
        vi.advanceTimersByTime(CURSOR_INTERVAL_MS);

        expect(emit.mock.calls.map(([event]) => event)).toContain('app:cursor-gone');
        expect(volatileEmit).toHaveBeenCalledTimes(1);
    });

    it('shows the pointers of the others and drops them when they leave or go', () => {
        const { collaboration, trigger } = joined();
        const listener = vi.fn();
        collaboration.subscribeCursors(listener);

        trigger('app:cursor', 'm1', 10, 20);
        expect(collaboration.getCursors()).toEqual([{ user: { ...MAX, me: false }, point: { x: 10, y: 20 } }]);

        trigger('app:cursor', 'm1', 11, 21);
        expect(collaboration.getCursors()[0]?.point).toEqual({ x: 11, y: 21 });

        trigger('app:cursor-gone', 'm1');
        expect(collaboration.getCursors()).toEqual([]);

        trigger('app:cursor', 'm1', 1, 1);
        trigger('app:left', { clients: 1, userId: 'm1' });
        expect(collaboration.getCursors()).toEqual([]);
        expect(listener).toHaveBeenCalledTimes(5);
    });

    it('forgets the pointers when the connection drops', () => {
        const { collaboration, trigger } = joined();
        trigger('app:cursor', 'm1', 10, 20);

        trigger('disconnect');

        expect(collaboration.getCursors()).toEqual([]);
    });

    it('stops sending once closed', () => {
        const { collaboration, volatileEmit } = joined();
        collaboration.sendCursor({ x: 1, y: 1 });
        collaboration.sendCursor({ x: 2, y: 2 });

        collaboration.close();
        vi.advanceTimersByTime(CURSOR_INTERVAL_MS * 2);

        expect(volatileEmit).toHaveBeenCalledTimes(1);
    });
});
