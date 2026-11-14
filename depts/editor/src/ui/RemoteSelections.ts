import type { RemoteSelection } from 'app/collaboration/createCollaboration';
import type { Collaborator } from 'app/collaboration/types';
import type { Id, Point } from 'app/cad/model/Point';
import type { Rect, Viewport } from 'app/cad/renderer/Viewport';
import { remoteCursorColor } from './RemoteCursors';

/** Gap between an element and the name over it, in view px. */
export const REMOTE_SELECTION_LABEL_GAP_PX = 3;
/** Up to this many elements of one collaborator get a name each; more share one over all of them. */
export const REMOTE_SELECTION_LABEL_LIMIT = 20;

/** A name to show: whose, and the model point its lower left corner sits over. */
export interface SelectionLabel {
    key: string;
    user: Collaborator;
    anchor: Point;
}

/**
 * The names over what the others selected: one at the upper left corner of each element, or one
 * over all of a collaborator's elements beyond REMOTE_SELECTION_LABEL_LIMIT. `boundsOf` gives the
 * model bounds (Y up) of an element, null for one that is not shown.
 */
export function selectionLabels(
    selections: readonly RemoteSelection[],
    boundsOf: (id: Id) => Rect | null,
    limit = REMOTE_SELECTION_LABEL_LIMIT,
): SelectionLabel[] {
    return selections.flatMap(({ user, ids }) => {
        const shown = ids.flatMap((id) => {
            const bounds = boundsOf(id);
            return bounds ? [{ id, bounds }] : [];
        });
        if (shown.length === 0) {
            return [];
        }
        if (shown.length <= limit) {
            return shown.map(({ id, bounds }) => ({ key: `${user.id}/${id}`, user, anchor: upperLeft(bounds) }));
        }
        const left = Math.min(...shown.map(({ bounds }) => bounds.x));
        const top = Math.max(...shown.map(({ bounds }) => bounds.y + bounds.height));
        return [{ key: user.id, user, anchor: { x: left, y: top } }];
    });
}

function upperLeft(bounds: Rect): Point {
    return { x: bounds.x, y: bounds.y + bounds.height };
}

/**
 * The names of the collaborators over the elements they selected, as a DOM layer over the drawing
 * like RemoteCursors: each name is moved by a CSS transform, takes no pointer input and follows
 * the viewport.
 */
export class RemoteSelections {
    private readonly root: HTMLDivElement;
    private readonly names = new Map<string, { element: HTMLSpanElement; label: SelectionLabel }>();
    private viewport: Viewport | null = null;

    constructor(container: HTMLElement) {
        this.root = document.createElement('div');
        this.root.className = 'remote-selections';
        this.root.setAttribute('aria-hidden', 'true');
        container.appendChild(this.root);
    }

    setViewport(viewport: Viewport): void {
        this.viewport = viewport;
        this.place();
    }

    /** Shows exactly these names. */
    set(labels: readonly SelectionLabel[]): void {
        const keys = new Set(labels.map(({ key }) => key));
        for (const [key, name] of this.names) {
            if (!keys.has(key)) {
                name.element.remove();
                this.names.delete(key);
            }
        }
        for (const label of labels) {
            let name = this.names.get(label.key);
            if (!name) {
                const element = document.createElement('span');
                element.className = 'remote-selection-name';
                this.root.appendChild(element);
                name = { element, label };
                this.names.set(label.key, name);
            }
            name.label = label;
            if (name.element.textContent !== label.user.name) {
                name.element.textContent = label.user.name;
            }
            name.element.style.setProperty('--remote-color', remoteCursorColor(label.user.color));
        }
        this.place();
    }

    dispose(): void {
        this.root.remove();
        this.names.clear();
    }

    private place(): void {
        if (!this.viewport) {
            return;
        }
        for (const { element, label } of this.names.values()) {
            const at = this.viewport.modelToView(label.anchor);
            // Its lower left corner over the element's upper left one
            element.style.transform = `translate(${at.x}px, ${at.y - REMOTE_SELECTION_LABEL_GAP_PX}px) translateY(-100%)`;
        }
    }
}
