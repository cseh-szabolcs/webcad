import { useEffect, useState } from 'react';
import type { CadApiClient } from 'app/cad/persistence/CadApiClient';
import { createCollaboration, type CollaborationState, type CursorChannel } from './createCollaboration';

const CONNECTING: CollaborationState = { status: 'connecting', users: [], me: null, limit: null };
const OFFLINE: CollaborationState = { ...CONNECTING, status: 'offline' };

/**
 * Logs the editor in to the room of the plan's project (see `createCollaboration`). Trouble never
 * stops the editor: when the access cannot be loaded the state is `offline`. `planId` null means
 * there is nothing to join (no plan, or generated data). `cursors` is the channel of the pointers
 * once connected, null before and after.
 */
export function useCollaboration(
    api: CadApiClient,
    planId: string | null,
): { state: CollaborationState; cursors: CursorChannel | null } {
    const [state, setState] = useState<CollaborationState>(CONNECTING);
    const [cursors, setCursors] = useState<CursorChannel | null>(null);

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
                setCursors(collaboration);
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
            setCursors(null);
        };
    }, [api, planId]);

    return planId === null ? { state: OFFLINE, cursors: null } : { state, cursors };
}
