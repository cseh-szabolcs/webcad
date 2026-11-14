import { t } from '../../../i18n/i18n';
import type { DocumentIndex } from '../../model/DocumentIndex';
import type { Id } from '../../model/Point';
import { subtractableShape } from '../commands/SubtractCommand';
import type { Message } from './EditorTool';

/** The objects of a selection that bound an area (closed polylines and circles), in its order. */
export function objectsWithArea(selection: ReadonlySet<Id>, index: DocumentIndex): Set<Id> {
    return new Set(
        [...selection].filter((id) => {
            const element = index.elements.get(id);
            return element !== undefined && subtractableShape(element, index) !== null;
        }),
    );
}

/** Names how many selected objects bound no area, which DIFFERENZ and VEREINIG pass over; none if all do. */
export function skippedMessage(count: number): Message | null {
    return count > 0 ? () => t('message.skippedNoArea', { count }) : null;
}
