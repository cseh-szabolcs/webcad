import paper from 'paper';
import type { Id } from '../../model/Point';
import type { SelectionArea, SelectionSnapshot } from '../SelectionEditor';

/** Colours tuned for the white canvas. */
const HOVERED = { color: '#60a5fa', extraWidth: 2 };
const SELECTED = { color: '#2563eb', extraWidth: 1 };
const GRIP = { color: '#1e90ff', sizePx: 7 };
/** Window: blue with a solid edge; crossing: green with a dashed edge (in screen px). */
const AREA = {
    window: { fill: 'rgba(37, 99, 235, 0.15)', stroke: '#2563eb', dash: [] as number[] },
    crossing: { fill: 'rgba(22, 163, 74, 0.15)', stroke: '#16a34a', dash: [6, 4] },
};

/** Source of the paths to highlight and the layer to draw into. */
export interface OverlayHost {
    readonly overlayLayer: paper.Layer;
    /** Current px per mm, to keep grips at a constant screen size. */
    readonly scale: number;
    getItemPath(id: Id): paper.Path | null;
}

/**
 * Draws the selection state on top of the document: highlights as restyled copies of the
 * rendered paths, grips as filled squares and the selection rectangle or lasso. Grips depend on the zoom, so render again after
 * every viewport change.
 */
export class SelectionOverlay {
    private readonly host: OverlayHost;

    constructor(host: OverlayHost) {
        this.host = host;
    }

    render({ hovered, highlighted, grips, area }: SelectionSnapshot): void {
        const layer = this.host.overlayLayer;
        layer.removeChildren();
        for (const id of hovered) {
            this.highlight(layer, id, HOVERED);
        }
        for (const id of highlighted) {
            this.highlight(layer, id, SELECTED);
        }
        const size = GRIP.sizePx / this.host.scale;
        for (const { x, y } of grips) {
            const grip = new paper.Path.Rectangle({ center: [x, y], size: [size, size], insert: false });
            grip.fillColor = new paper.Color(GRIP.color);
            layer.addChild(grip);
        }
        if (area) {
            layer.addChild(this.areaPath(area));
        }
    }

    private areaPath(area: SelectionArea): paper.Path {
        const style = AREA[area.mode];
        const path =
            area.shape === 'rect'
                ? new paper.Path.Rectangle({
                      from: [area.first.x, area.first.y],
                      to: [area.second.x, area.second.y],
                      insert: false,
                  })
                : new paper.Path({ segments: area.points.map((p) => [p.x, p.y]), closed: true, insert: false });
        path.fillColor = new paper.Color(style.fill);
        path.strokeColor = new paper.Color(style.stroke);
        path.strokeWidth = 1;
        path.dashArray = style.dash;
        path.strokeScaling = false;
        return path;
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
