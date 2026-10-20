import paper from 'paper';
import type { Id } from '../../model/Point';
import type { SelectionSnapshot } from '../SelectionEditor';

/** Colours tuned for the white canvas. */
const HOVERED = { color: '#60a5fa', extraWidth: 2 };
const SELECTED = { color: '#2563eb', extraWidth: 1 };
const GRIP = { color: '#1e90ff', sizePx: 7 };

/** Source of the paths to highlight and the layer to draw into. */
export interface OverlayHost {
    readonly overlayLayer: paper.Layer;
    /** Current px per mm, to keep grips at a constant screen size. */
    readonly scale: number;
    getItemPath(id: Id): paper.Path | null;
}

/**
 * Draws the selection state on top of the document: highlights as restyled copies of the
 * rendered paths, grips as filled squares. Grips depend on the zoom, so render again after
 * every viewport change.
 */
export class SelectionOverlay {
    private readonly host: OverlayHost;

    constructor(host: OverlayHost) {
        this.host = host;
    }

    render({ hovered, selected, grips }: SelectionSnapshot): void {
        const layer = this.host.overlayLayer;
        layer.removeChildren();
        for (const id of hovered) {
            this.highlight(layer, id, HOVERED);
        }
        for (const id of selected) {
            this.highlight(layer, id, SELECTED);
        }
        const size = GRIP.sizePx / this.host.scale;
        for (const { x, y } of grips) {
            const grip = new paper.Path.Rectangle({ center: [x, y], size: [size, size], insert: false });
            grip.fillColor = new paper.Color(GRIP.color);
            layer.addChild(grip);
        }
    }

    private highlight(layer: paper.Layer, id: Id, style: typeof HOVERED): void {
        const source = this.host.getItemPath(id);
        if (!source) {
            return;
        }
        // Keeps the dash pattern, so the linetype stays recognisable
        const copy = source.clone({ insert: false, deep: false }) as paper.Path;
        copy.fillColor = null;
        copy.strokeColor = new paper.Color(style.color);
        copy.strokeWidth = source.strokeWidth + style.extraWidth;
        copy.strokeScaling = false;
        copy.data = {};
        layer.addChild(copy);
    }
}
