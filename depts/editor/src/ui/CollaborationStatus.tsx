import { useTranslation } from 'react-i18next';
import type { CollaborationState } from 'app/collaboration/createCollaboration';

/** Who is in the project's room, as a dot, a count and a tooltip with the names. */
export function CollaborationStatus({ state }: { state: CollaborationState }) {
    const { t } = useTranslation();
    const names = state.users.map((user) => user.name).join(', ');
    const title =
        state.status === 'connecting'
            ? t('collaboration.connecting')
            : state.status === 'offline'
              ? t('collaboration.offline')
              : state.status === 'full'
                ? t('collaboration.full', { limit: state.limit, names })
                : t('collaboration.connected', { names });
    const label = state.status === 'connected' ? t('collaboration.people', { count: state.users.length }) : null;

    return (
        <span className={`collaboration-status collaboration-status-${state.status}`} title={title} role="status" aria-label={title}>
            <span className="collaboration-dot" aria-hidden="true" />
            {label}
        </span>
    );
}
