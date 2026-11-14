import { useEffect, useState } from 'react';
import type { CadApiClient } from 'app/cad/persistence/CadApiClient';
import { createCollaboration, type CollaborationState } from './createCollaboration';

const CONNECTING: CollaborationState = { status: 'connecting', users: [], me: null, limit: null };
const OFFLINE: CollaborationState = { ...CONNECTING, status: 'offline' };

/**
 * Logs the editor in to the room of the plan's project (see `createCollaboration`). Trouble never
 * stops the editor: when the access cannot be loaded the state is `offline`. `planId` null means
 * there is nothing to join (no plan, or generated data).
 */
export function useCollaboration(api: CadApiClient, planId: string | null): CollaborationState {
    const [state, setState] = useState<CollaborationState>(CONNECTING);

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
        };
    }, [api, planId]);

    return planId === null ? OFFLINE : state;
}
