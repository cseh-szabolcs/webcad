import paper from 'paper';
import type { Id } from '../../model/Point';
import type { Vertex } from '../../model/Vertex';

const SELECTED = { color: '#f97316', extraWidth: 2 };
const HOVERED = { color: '#fdba74', extraWidth: 2 };
const HANDLE_SIZE_PX = 8;

/** Source of the paths to highlight and the layer to draw into. */
export interface OverlayHost {
    readonly overlayLayer: paper.Layer;
    /** Current px per mm, to keep handles at a constant screen size. */
    readonly scale: number;
    getItemPath(id: Id): paper.Path | null;
}

/** Draws selection and hover highlights as restyled copies of the rendered paths, plus vertex handles. */
export class SelectionOverlay {
    private readonly host: OverlayHost;

    constructor(host: OverlayHost) {
        this.host = host;
    }

    render(selected: ReadonlySet<Id>, hovered: Id | null, handles: Vertex[], activeHandle: Id | null): void {
        const layer = this.host.overlayLayer;
        layer.removeChildren();
        if (hovered !== null && !selected.has(hovered)) {
            this.highlight(layer, hovered, HOVERED);
        }
        for (const id of selected) {
            this.highlight(layer, id, SELECTED);
        }
        const size = HANDLE_SIZE_PX / this.host.scale;
        for (const vertex of handles) {
            const handle = new paper.Path.Rectangle({
                center: [vertex.x, vertex.y],
                size: [size, size],
                insert: false,
            });
            handle.fillColor = new paper.Color(vertex.id === activeHandle ? SELECTED.color : '#ffffff');
            handle.strokeColor = new paper.Color(SELECTED.color);
            handle.strokeWidth = 1;
            handle.strokeScaling = false;
            layer.addChild(handle);
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
