import { describe, expect, it, vi } from 'vitest';
import { createCollaboration, type CollaborationAccess, type CollaborationSocket } from './createCollaboration';
import type { Collaborator, JoinAck } from './types';

const ACCESS: CollaborationAccess = { namespace: 'tenant', room: 'project', userName: 'Erika', token: 'token' };
const ERIKA: Collaborator = { id: 'e1', name: 'Erika', image: null };
const MAX: Collaborator = { id: 'm1', name: 'Max', image: null };

/** A socket the test drives by hand: `trigger` fires the listeners of an event. */
function fakeSocket() {
    const listeners = new Map<string, ((...args: never[]) => void)[]>();
    const emit = vi.fn<(event: string, ...args: unknown[]) => void>();
    const close = vi.fn();
    const socket: CollaborationSocket = {
        on: (event, listener) => void listeners.set(event, [...(listeners.get(event) ?? []), listener]),
        emit,
        close,
    };
    return {
        socket,
        emit,
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
