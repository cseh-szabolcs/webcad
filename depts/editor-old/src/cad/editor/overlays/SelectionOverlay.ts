import paper from 'paper';
import type { Id } from '../../model/Point';
import type { OverlayState } from '../EditorView';

const SELECTED = { color: '#f97316', extraWidth: 2 };
const HOVERED = { color: '#fdba74', extraWidth: 2 };
const HANDLE_SIZE_PX = 8;
/** Green for stored vertices, purple for derived points (midpoints, quadrants). */
const SNAP = { color: '#16a34a', derivedColor: '#9333ea', sizePx: 12, strokeWidth: 2 };

/** Source of the paths to highlight and the layer to draw into. */
export interface OverlayHost {
    readonly overlayLayer: paper.Layer;
    /** Current px per mm, to keep handles at a constant screen size. */
    readonly scale: number;
    getItemPath(id: Id): paper.Path | null;
}

/**
 * Draws selection and hover highlights as restyled copies of the rendered paths, plus handles
 * and the snap marker (an unfilled square, like AutoCAD's endpoint marker).
 */
export class SelectionOverlay {
    private readonly host: OverlayHost;

    constructor(host: OverlayHost) {
        this.host = host;
    }

    render({ selected, hovered, handles, activeHandle, snap }: OverlayState): void {
        const layer = this.host.overlayLayer;
        layer.removeChildren();
        for (const id of hovered) {
            if (!selected.has(id)) {
                this.highlight(layer, id, HOVERED);
            }
        }
        for (const id of selected) {
            this.highlight(layer, id, SELECTED);
        }
        const size = HANDLE_SIZE_PX / this.host.scale;
        for (const { id, x, y } of handles) {
            const handle = new paper.Path.Rectangle({
                center: [x, y],
                size: [size, size],
                insert: false,
            });
            handle.fillColor = new paper.Color(id === activeHandle ? SELECTED.color : '#ffffff');
            handle.strokeColor = new paper.Color(SELECTED.color);
            handle.strokeWidth = 1;
            handle.strokeScaling = false;
            layer.addChild(handle);
        }
        if (snap) {
            const markerSize = SNAP.sizePx / this.host.scale;
            const marker = new paper.Path.Rectangle({
                center: [snap.x, snap.y],
                size: [markerSize, markerSize],
                insert: false,
            });
            marker.strokeColor = new paper.Color(snap.derived ? SNAP.derivedColor : SNAP.color);
            marker.strokeWidth = SNAP.strokeWidth;
            marker.strokeScaling = false;
            layer.addChild(marker);
        }
    }

    private highlight(layer: paper.Layer, id: Id, style: typeof SELECTED): void {
        const source = this.host.getItemPath(id);
        if (!source) {
            return;
        }
        const copy = source.clone({ insert: false, deep: false }) as paper.Path;
        copy.fillColor = null;
        copy.strokeColor = new paper.Color(style.color);
        copy.strokeWidth = source.strokeWidth + style.extraWidth;
        copy.dashArray = [];
        copy.strokeScaling = false;
        copy.data = {};
        layer.addChild(copy);
    }
}
