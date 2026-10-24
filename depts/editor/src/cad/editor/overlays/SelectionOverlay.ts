import paper from 'paper';
import type { Id } from '../../model/Point';
import type { DisplayTheme } from '../../renderer/displayColor';
import type { SelectionArea, SelectionSnapshot } from '../SelectionEditor';

const HOVER_EXTRA_WIDTH = 2;
const SELECTED_EXTRA_WIDTH = 1;
const GRIP_SIZE_PX = 7;
/** Control frame lines in the grip colour, thin and dashed (screen px). */
const CONTROL_FRAME_DASH = [4, 3];
/** Crossing areas get a dashed edge (screen px), windows a solid one. */
const AREA_DASH = { window: [] as number[], crossing: [6, 4] };

/**
 * Overlay colours per background. On dark, hover and selection are lighter blues so they
 * stand out against the light (inverted) drawing colours.
 */
const PALETTES = {
    light: {
        hovered: '#60a5fa',
        selected: '#2563eb',
        grip: '#1e90ff',
        window: { fill: 'rgba(37, 99, 235, 0.15)', stroke: '#2563eb' },
        crossing: { fill: 'rgba(22, 163, 74, 0.15)', stroke: '#16a34a' },
    },
    dark: {
        hovered: '#93c5fd',
        selected: '#60a5fa',
        grip: '#1e90ff',
        window: { fill: 'rgba(59, 130, 246, 0.25)', stroke: '#60a5fa' },
        crossing: { fill: 'rgba(34, 197, 94, 0.22)', stroke: '#4ade80' },
    },
} satisfies Record<DisplayTheme, unknown>;

/** Source of the paths to highlight and the layer to draw into. */
export interface OverlayHost {
    readonly overlayLayer: paper.Layer;
    /** Current px per mm, to keep grips at a constant screen size. */
    readonly scale: number;
    getItemPath(id: Id): paper.Path | null;
}

/**
 * Draws the selection state on top of the document: highlights as restyled copies of the
 * rendered paths, grips as filled squares with the control frame of curves, and the
 * selection rectangle or lasso. Grips depend
 * on the zoom, so render again after every viewport change (and after setTheme()).
 */
export class SelectionOverlay {
    private readonly host: OverlayHost;
    private palette: (typeof PALETTES)[DisplayTheme] = PALETTES.light;

    constructor(host: OverlayHost) {
        this.host = host;
    }

    /** Takes effect with the next render(). */
    setTheme(theme: DisplayTheme): void {
        this.palette = PALETTES[theme];
    }

    render({ hovered, highlighted, grips, controlFrames, area }: SelectionSnapshot): void {
        const layer = this.host.overlayLayer;
        layer.removeChildren();
        for (const id of hovered) {
            this.highlight(layer, id, this.palette.hovered, HOVER_EXTRA_WIDTH);
        }
        for (const id of highlighted) {
            this.highlight(layer, id, this.palette.selected, SELECTED_EXTRA_WIDTH);
        }
        // Below the grips, so the grips stay whole at the line ends
        for (const [from, to] of controlFrames) {
            const line = new paper.Path.Line({ from: [from.x, from.y], to: [to.x, to.y], insert: false });
            line.strokeColor = new paper.Color(this.palette.grip);
            line.strokeWidth = 1;
            line.dashArray = CONTROL_FRAME_DASH;
            line.strokeScaling = false;
            layer.addChild(line);
        }
        const size = GRIP_SIZE_PX / this.host.scale;
        for (const { x, y } of grips) {
            const grip = new paper.Path.Rectangle({ center: [x, y], size: [size, size], insert: false });
            grip.fillColor = new paper.Color(this.palette.grip);
            layer.addChild(grip);
        }
        if (area) {
            layer.addChild(this.areaPath(area));
        }
    }

    private areaPath(area: SelectionArea): paper.Path {
        const style = this.palette[area.mode];
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
        path.dashArray = AREA_DASH[area.mode];
        path.strokeScaling = false;
        return path;
    }

    private highlight(layer: paper.Layer, id: Id, color: string, extraWidth: number): void {
        const source = this.host.getItemPath(id);
        if (!source) {
            return;
        }
        // Keeps the dash pattern, so the linetype stays recognisable
        const copy = source.clone({ insert: false, deep: false }) as paper.Path;
        copy.fillColor = null;
        copy.strokeColor = new paper.Color(color);
        copy.strokeWidth = source.strokeWidth + extraWidth;
        copy.strokeScaling = false;
        copy.data = {};
        layer.addChild(copy);
    }
}
