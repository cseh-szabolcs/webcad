import paper from 'paper';
import type { Id, Point } from '../../model/Point';
import type { DisplayTheme } from '../../renderer/displayColor';
import { ellipsePathSpec } from '../../renderer/PathSpec';
import type { PreviewCurve } from '../tools/EditorTool';
import type { SelectionArea, SelectionSnapshot } from '../SelectionEditor';

const HOVER_EXTRA_WIDTH = 2;
const SELECTED_EXTRA_WIDTH = 1;
const GRIP_SIZE_PX = 7;
/** Control frame lines in the grip colour, thin and dashed (screen px). */
const CONTROL_FRAME_DASH = [4, 3];
/** Crossing areas get a dashed edge (screen px), windows a solid one. */
const AREA_DASH = { window: [] as number[], crossing: [6, 4] };
/** The move preview copies are slightly see-through, so what lies below stays visible. */
const PREVIEW_OPACITY = 0.7;

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
    /** The layer to draw into; makes its Paper.js scope the active one (see PaperRenderer). */
    activateOverlay(): paper.Layer;
    /** Current px per mm, to keep grips at a constant screen size. */
    readonly scale: number;
    getItemPath(id: Id): paper.Path | null;
    /** Changes whenever the rendered paths or their display style may have changed. */
    readonly revision: number;
    /** Gives `item` the display style of element `id` (the rendered item may be dimmed). */
    applyElementStyle(item: paper.Path, id: Id): void;
    /** Gives `item` the display style `styleId`, the default style for null. */
    applyStyleById(item: paper.Path, styleId: Id | null): void;
}

/**
 * Draws the selection state on top of the document: highlights as restyled copies of the
 * rendered paths, grips as filled squares with the control frame of curves, and the
 * selection rectangle or lasso. While SCHIEBEN asks for the second point, it previews the
 * move like AutoCAD: copies of the selected paths in their own style (slightly
 * see-through), offset from the base point to the preview point (the rubber band between
 * the two is drawn by SnapMarker, above the polar path). While LINIE asks for the next point,
 * it previews the new line from the last point to the preview point, while PLINIE does, the
 * polyline drawn so far on to the preview point (at its length prompt a segment in the
 * direction of the last one, as long as the preview point is from the last point; the rubber
 * band to the preview point is SnapMarker's), while KREIS, ELLIPSE or RECHTECK ask for a point,
 * the circle, ellipse or rectangle a click there would give. The originals are then not
 * highlighted; the canvas dims them (PaperRenderer.setDimmed); the document stays
 * unchanged. Grips depend on the zoom, so render again after every viewport change (and
 * after setTheme()).
 *
 * Only what changed is rebuilt: the selection highlights, the move copies and the grips stay
 * until the selection, the rendered paths (OverlayHost.revision), the theme or the zoom change;
 * a move only shifts the group of its copies.
 */
export class SelectionOverlay {
    private readonly host: OverlayHost;
    private palette: (typeof PALETTES)[DisplayTheme] = PALETTES.light;
    /** The parts of the overlay, bottom to top; made on the first render(). */
    private groups: OverlayGroups | null = null;
    /** What the selection highlights, the move copies and the grips were last built from. */
    private selectionKey: readonly unknown[] | null = null;
    private moveKey: readonly unknown[] | null = null;
    private gripsKey: readonly unknown[] | null = null;

    constructor(host: OverlayHost) {
        this.host = host;
    }

    /** Takes effect with the next render(). */
    setTheme(theme: DisplayTheme): void {
        this.palette = PALETTES[theme];
    }

    render({ hovered, highlighted, grips, controlFrames, area, from, preview, previewPoint }: SelectionSnapshot): void {
        const layer = this.host.activateOverlay();
        const groups = (this.groups ??= createGroups(layer));
        const { revision, scale } = this.host;
        const palette = this.palette;
        const basePoint = preview === 'move' ? from : null;

        groups.hover.removeChildren();
        for (const id of hovered) {
            this.highlight(groups.hover, id, palette.hovered, HOVER_EXTRA_WIDTH);
        }

        // While moving, the originals are dimmed instead
        groups.selection.visible = !basePoint;
        if (!basePoint && changed(this.selectionKey, [highlighted, revision, palette])) {
            this.selectionKey = [highlighted, revision, palette];
            groups.selection.removeChildren();
            for (const id of highlighted) {
                this.highlight(groups.selection, id, palette.selected, SELECTED_EXTRA_WIDTH);
            }
        }

        // The copies are made once per move; each cursor position only shifts their group
        const moving = basePoint !== null && previewPoint !== null;
        groups.move.visible = moving;
        if (moving) {
            if (changed(this.moveKey, [highlighted, revision])) {
                this.moveKey = [highlighted, revision];
                groups.move.removeChildren();
                this.moveCopies(groups.move, highlighted);
            }
            groups.move.matrix = new paper.Matrix(1, 0, 0, 1, previewPoint.x - basePoint.x, previewPoint.y - basePoint.y);
        } else if (this.moveKey !== null) {
            this.moveKey = null;
            groups.move.removeChildren();
        }

        groups.preview.removeChildren();
        if (preview === 'line' && from && previewPoint) {
            this.linePreview(groups.preview, from, previewPoint);
        }
        if (typeof preview === 'object' && preview?.kind === 'polyline') {
            const points = previewPoint ? [...preview.points, polylineEnd(preview, previewPoint)] : preview.points;
            this.polylinePreview(groups.preview, points);
        }
        if (typeof preview === 'object' && preview?.kind === 'curve' && previewPoint) {
            const curve = preview.curveAt(previewPoint);
            if (curve) {
                this.curvePreview(groups.preview, curve);
            }
        }

        // Grips keep their screen size, so they also follow the zoom
        if (changed(this.gripsKey, [grips, controlFrames, scale, palette])) {
            this.gripsKey = [grips, controlFrames, scale, palette];
            groups.grips.removeChildren();
            // The frames below the grips, so the grips stay whole at the line ends
            for (const [from, to] of controlFrames) {
                const line = new paper.Path.Line({ from: [from.x, from.y], to: [to.x, to.y], insert: false });
                line.strokeColor = new paper.Color(palette.grip);
                line.strokeWidth = 1;
                line.dashArray = CONTROL_FRAME_DASH;
                line.strokeScaling = false;
                groups.grips.addChild(line);
            }
            const size = GRIP_SIZE_PX / scale;
            for (const { x, y } of grips) {
                const grip = new paper.Path.Rectangle({ center: [x, y], size: [size, size], insert: false });
                grip.fillColor = new paper.Color(palette.grip);
                groups.grips.addChild(grip);
            }
        }

        groups.area.removeChildren();
        if (area) {
            groups.area.addChild(this.areaPath(area));
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

    /** Copies of the elements in their own style, slightly see-through, at their place. */
    private moveCopies(parent: paper.Group, ids: Iterable<Id>): void {
        for (const id of ids) {
            const source = this.host.getItemPath(id);
            if (!source) {
                continue;
            }
            const copy = source.clone({ insert: false, deep: false }) as paper.Path;
            this.host.applyElementStyle(copy, id);
            copy.opacity = PREVIEW_OPACITY;
            copy.data = {};
            parent.addChild(copy);
        }
    }

    /** The line LINIE would add, solid in the style of new lines, like AutoCAD's rubber band. */
    private linePreview(parent: paper.Group, from: Point, to: Point): void {
        const line = new paper.Path.Line({ from: [from.x, from.y], to: [to.x, to.y], insert: false });
        line.strokeScaling = false;
        this.host.applyStyleById(line, null);
        parent.addChild(line);
    }

    /** The polyline PLINIE draws, not yet in the document, in the style of new elements. */
    private polylinePreview(parent: paper.Group, points: readonly Point[], closed = false): void {
        const path = new paper.Path({ segments: points.map((p) => [p.x, p.y]), closed, insert: false });
        path.strokeScaling = false;
        this.host.applyStyleById(path, null);
        parent.addChild(path);
    }

    /** The circle, ellipse or rectangle KREIS, ELLIPSE or RECHTECK would add, in the style of new elements. */
    private curvePreview(parent: paper.Group, curve: PreviewCurve): void {
        if (curve.kind === 'polygon') {
            this.polylinePreview(parent, curve.points, true);
            return;
        }
        const spec =
            curve.kind === 'circle'
                ? ellipsePathSpec(curve.center, curve.radius, curve.radius)
                : ellipsePathSpec(curve.center, curve.radiusX, curve.radiusY, curve.rotation);
        const path = new paper.Path({
            segments: spec.segments.map(
                ({ point, handleIn, handleOut }) =>
                    new paper.Segment(
                        new paper.Point(point.x, point.y),
                        handleIn && new paper.Point(handleIn.x, handleIn.y),
                        handleOut && new paper.Point(handleOut.x, handleOut.y),
                    ),
            ),
            closed: true,
            insert: false,
        });
        path.strokeScaling = false;
        this.host.applyStyleById(path, null);
        parent.addChild(path);
    }

    private highlight(parent: paper.Group, id: Id, color: string, extraWidth: number): void {
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
        parent.addChild(copy);
    }
}

interface OverlayGroups {
    hover: paper.Group;
    selection: paper.Group;
    move: paper.Group;
    preview: paper.Group;
    grips: paper.Group;
    area: paper.Group;
}

function createGroups(layer: paper.Layer): OverlayGroups {
    const group = () => {
        const item = new paper.Group({ insert: false });
        // Shifting a group must not rewrite its children (see the move copies)
        item.applyMatrix = false;
        layer.addChild(item);
        return item;
    };
    return { hover: group(), selection: group(), move: group(), preview: group(), grips: group(), area: group() };
}

/** Whether `key` differs from the key something was last built from. */
function changed(previous: readonly unknown[] | null, key: readonly unknown[]): boolean {
    return previous === null || previous.length !== key.length || key.some((value, i) => value !== previous[i]);
}

/** Where the segment to `point` ends: there, or along `direction` as far as `point` is from the last point. */
function polylineEnd({ points, direction }: { points: readonly Point[]; direction?: Point }, point: Point): Point {
    const last = points.at(-1);
    if (!direction || !last) {
        return point;
    }
    const length = Math.hypot(point.x - last.x, point.y - last.y);
    return { x: last.x + direction.x * length, y: last.y + direction.y * length };
}
