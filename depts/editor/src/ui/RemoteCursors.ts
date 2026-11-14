import type { RemoteCursor } from 'app/collaboration/createCollaboration';
import { COLLABORATOR_COLORS } from 'app/collaboration/types';
import type { Viewport } from 'app/cad/renderer/Viewport';

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Length of each arm of a pointer's cross, in view px. */
export const REMOTE_CURSOR_ARM_PX = 7;
/** Gap between the cross and its name, in view px. */
export const REMOTE_CURSOR_LABEL_GAP_PX = 3;

/** SVG path of the cross around its centre: two arms each way, as plain lines (dashed by CSS). */
export function remoteCursorPath(arm: number): string {
    return `M${-arm} 0H${arm}M0 ${-arm}V${arm}`;
}

/** The CSS token of a collaborator's colour; the palette repeats beyond its size. */
export function remoteCursorColor(color: number): string {
    return `var(--collab-color-${((color % COLLABORATOR_COLORS) + COLLABORATOR_COLORS) % COLLABORATOR_COLORS})`;
}

interface Pointer {
    root: HTMLDivElement;
    label: HTMLSpanElement;
    cursor: RemoteCursor;
}

/**
 * The pointers of the other collaborators, as a DOM layer over the drawing and under the own
 * crosshair: a small dashed cross in the collaborator's colour and, up and to the right of it, their
 * name, faint enough not to get in the way. Each is moved by a CSS transform, so a pointer moving
 * never redraws the drawing. It takes no pointer input. Positions are model points; the layer
 * follows the viewport itself.
 */
export class RemoteCursors {
    private readonly root: HTMLDivElement;
    private readonly pointers = new Map<string, Pointer>();
    private viewport: Viewport | null = null;

    constructor(container: HTMLElement) {
        this.root = document.createElement('div');
        this.root.className = 'remote-cursors';
        this.root.setAttribute('aria-hidden', 'true');
        container.appendChild(this.root);
    }

    setViewport(viewport: Viewport): void {
        this.viewport = viewport;
        this.place();
    }

    /** Shows exactly these pointers: new ones appear, the others move, the rest go. */
    set(cursors: readonly RemoteCursor[]): void {
        const ids = new Set(cursors.map(({ user }) => user.id));
        for (const [id, pointer] of this.pointers) {
            if (!ids.has(id)) {
                pointer.root.remove();
                this.pointers.delete(id);
            }
        }
        for (const cursor of cursors) {
            const pointer = this.pointers.get(cursor.user.id) ?? this.create(cursor);
            pointer.cursor = cursor;
            if (pointer.label.textContent !== cursor.user.name) {
                pointer.label.textContent = cursor.user.name;
            }
            pointer.root.style.setProperty('--remote-color', remoteCursorColor(cursor.user.color));
        }
        this.place();
    }

    dispose(): void {
        this.root.remove();
        this.pointers.clear();
    }

    private create(cursor: RemoteCursor): Pointer {
        const root = document.createElement('div');
        root.className = 'remote-cursor';
        const svg = document.createElementNS(SVG_NS, 'svg');
        svg.setAttribute('class', 'remote-cursor-cross');
        const path = document.createElementNS(SVG_NS, 'path');
        path.setAttribute('d', remoteCursorPath(REMOTE_CURSOR_ARM_PX));
        svg.appendChild(path);
        const label = document.createElement('span');
        label.className = 'remote-cursor-name';
        label.style.left = `${REMOTE_CURSOR_LABEL_GAP_PX}px`;
        label.style.bottom = `${REMOTE_CURSOR_LABEL_GAP_PX}px`;
        root.append(svg, label);
        this.root.appendChild(root);
        const pointer = { root, label, cursor };
        this.pointers.set(cursor.user.id, pointer);
        return pointer;
    }

    private place(): void {
        if (!this.viewport) {
            return;
        }
        for (const { root, cursor } of this.pointers.values()) {
            const at = this.viewport.modelToView(cursor.point);
            root.style.transform = `translate(${at.x}px, ${at.y}px)`;
        }
    }
}
