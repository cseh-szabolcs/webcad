import { useEffect, useState } from 'react';
import type { CadApiClient } from 'app/cad/persistence/CadApiClient';
import { createCollaboration, type CollaborationState, type PresenceChannel } from './createCollaboration';

const CONNECTING: CollaborationState = { status: 'connecting', users: [], me: null, limit: null };
const OFFLINE: CollaborationState = { ...CONNECTING, status: 'offline' };

/**
 * Logs the editor in to the room of the plan's project (see `createCollaboration`). Trouble never
 * stops the editor: when the access cannot be loaded the state is `offline`. `planId` null means
 * there is nothing to join (no plan, or generated data). `presence` is the channel of the pointers
 * and the selections once connected, null before and after.
 */
export function useCollaboration(
    api: CadApiClient,
    planId: string | null,
): { state: CollaborationState; presence: PresenceChannel | null } {
    const [state, setState] = useState<CollaborationState>(CONNECTING);
    const [presence, setPresence] = useState<PresenceChannel | null>(null);

    useEffect(() => {
        if (planId === null) {
            return;
        }
        const controller = new AbortController();
        let close: (() => void) | null = null;
        const fetchAccess = () => api.loadCollaborationAccess(planId, controller.signal);

        fetchAccess().then(
            (access) => {
                if (controller.signal.aborted) {
                    return;
                }
                const collaboration = createCollaboration(access, async () => (await fetchAccess()).token);
                const update = () => setState(collaboration.getState());
                collaboration.subscribe(update);
                close = () => collaboration.close();
                setPresence(collaboration);
                update();
            },
            () => {
                if (!controller.signal.aborted) {
                    setState(OFFLINE);
                }
            },
        );

        return () => {
            controller.abort();
            close?.();
            setPresence(null);
        };
    }, [api, planId]);

    return planId === null ? { state: OFFLINE, presence: null } : { state, presence };
}
