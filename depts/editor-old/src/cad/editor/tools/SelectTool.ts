import type { EllipseElement } from '../../model/CadElement';
import type { Id, Point, Vector2 } from '../../model/Point';
import type { EditorKeyEvent } from '../CadEditor';
import { MoveVerticesCommand } from '../commands/MoveVerticesCommand';
import { ResizeEllipseCommand } from '../commands/ResizeEllipseCommand';
import { selectionUnit } from '../grouping';
import { selectedVertexIds, type Handle, type RadiusSide } from '../selectionHandles';
import { findSnap } from '../snapping/snapPoints';
import type { Tool, ToolContext, ToolPointerEvent } from './Tool';

const DRAG_THRESHOLD_PX = 3;
const HANDLE_HIT_PX = 6;
/** Same as AutoCAD's default aperture. */
const SNAP_RADIUS_PX = 10;

type State =
    | { kind: 'idle' }
    /** Pointer down on an element (and its group); becomes a move once it travels past the threshold. */
    | { kind: 'pressed'; unit: Id[]; start: Point; startView: Point; wasSelected: boolean }
    | { kind: 'moveSelection'; start: Point; vertexIds: Id[]; moved: boolean }
    /** `origin` is the vertex position when the drag started. */
    | { kind: 'dragHandle'; start: Point; origin: Point; vertexId: Id; moved: boolean }
    | { kind: 'dragRadius'; start: Point; element: EllipseElement; side: RadiusSide; moved: boolean };

/**
 * Click selects, Shift+click toggles, click on empty space clears.
 * Clicking a grouped element selects its whole group; Alt+click selects just that element.
 * Hover highlights what a click would select.
 * Dragging a selected element moves the selection; dragging a vertex handle moves that vertex.
 * While snapping is on, a dragged vertex snaps to other vertices, midpoints and ellipse
 * quadrants within 10 px (position only, no connection).
 * Dragging a side handle of an ellipse changes that radius around the fixed centre
 * (with Shift both radii scale together, keeping the aspect ratio).
 * All of them preview while dragging and commit one command on release.
 */
export class SelectTool implements Tool {
    private readonly context: ToolContext;
    private state: State = { kind: 'idle' };
    private hoverCursor = 'default';

    constructor(context: ToolContext) {
        this.context = context;
    }

    get cursor(): string {
        switch (this.state.kind) {
            case 'moveSelection':
            case 'dragHandle':
                return 'move';
            case 'dragRadius':
                return resizeCursor(this.state.side);
            default:
                return this.hoverCursor;
        }
    }

    onPointerDown(event: ToolPointerEvent): void {
        if (event.button !== 0) {
            return;
        }
        const { selection } = this.context;

        const handle = this.handleAt(event);
        if (handle !== null) {
            this.startHandleDrag(handle, event.modelPoint);
            return;
        }

        const id = this.context.hitTest(event.viewPoint);
        if (id === null) {
            if (!event.shiftKey) {
                selection.clear();
            }
            return;
        }
        const unit = this.unitAt(id, event.altKey);
        const wasSelected = unit.every((member) => selection.selected.has(member));
        if (event.shiftKey) {
            const others = [...selection.selected].filter((selected) => !unit.includes(selected));
            selection.select(wasSelected ? others : [...others, ...unit]);
            return;
        }

        if (!wasSelected) {
            selection.select(unit);
        }
        this.state = { kind: 'pressed', unit, start: event.modelPoint, startView: event.viewPoint, wasSelected };
    }

    onPointerMove(event: ToolPointerEvent): void {
        const state = this.state;
        switch (state.kind) {
            case 'idle':
                this.updateHover(event);
                return;
            case 'pressed': {
                const dx = event.viewPoint.x - state.startView.x;
                const dy = event.viewPoint.y - state.startView.y;
                if (Math.hypot(dx, dy) <= DRAG_THRESHOLD_PX) {
                    return;
                }
                const vertexIds = selectedVertexIds(this.context.document, this.context.selection.selected);
                this.state = { kind: 'moveSelection', start: state.start, vertexIds, moved: false };
                this.previewMove(event);
                return;
            }
            case 'moveSelection':
            case 'dragHandle':
                this.previewMove(event);
                return;
            case 'dragRadius':
                this.previewResize(event);
                return;
        }
    }

    onPointerUp(): void {
        const state = this.state;
        this.state = { kind: 'idle' };
        switch (state.kind) {
            case 'pressed':
                // Clicking one element of a multi-selection without dragging selects just that one (or its group)
                if (state.wasSelected && this.context.selection.selected.size > state.unit.length) {
                    this.context.selection.select(state.unit);
                }
                return;
            case 'moveSelection':
            case 'dragHandle':
            case 'dragRadius':
                if (state.moved) {
                    this.context.commitPreview();
                } else {
                    this.context.cancelPreview();
                }
                if (state.kind !== 'moveSelection') {
                    this.context.setActiveHandle(null);
                }
                this.context.setSnapIndicator(null);
                return;
        }
    }

    onPointerLeave(): void {
        if (this.state.kind === 'idle') {
            this.context.selection.setHovered([]);
            this.context.setActiveHandle(null);
        }
    }

    onKeyDown(event: EditorKeyEvent): boolean {
        if (event.key === 'Escape' && this.state.kind !== 'idle') {
            this.onCancel();
            return true;
        }
        return false;
    }

    onCancel(): void {
        if (this.state.kind !== 'idle') {
            this.state = { kind: 'idle' };
            this.context.cancelPreview();
            this.context.setActiveHandle(null);
            this.context.setSnapIndicator(null);
        }
    }

    onDeactivate(): void {
        this.onCancel();
        this.context.selection.setHovered([]);
    }

    private updateHover(event: ToolPointerEvent): void {
        const handle = this.handleAt(event);
        this.context.setActiveHandle(handle?.id ?? null);
        const id = handle === null ? this.context.hitTest(event.viewPoint) : null;
        this.context.selection.setHovered(id === null ? [] : this.unitAt(id, event.altKey));
        if (handle?.kind === 'radius') {
            this.hoverCursor = resizeCursor(handle.side);
        } else {
            this.hoverCursor = handle !== null || id !== null ? 'pointer' : 'default';
        }
    }

    /** What a click on the element selects: its whole group, or with Alt just the element. */
    private unitAt(id: Id, altKey: boolean): Id[] {
        return altKey ? [id] : selectionUnit(this.context.document, id);
    }

    private startHandleDrag(handle: Handle, start: Point): void {
        if (handle.kind === 'vertex') {
            const origin = { x: handle.x, y: handle.y };
            this.state = { kind: 'dragHandle', start, origin, vertexId: handle.vertexId, moved: false };
        } else {
            const element = this.context.document.elements.find((e) => e.id === handle.elementId);
            if (element?.type !== 'ellipse') {
                return;
            }
            this.state = { kind: 'dragRadius', start, element, side: handle.side, moved: false };
        }
        this.context.setActiveHandle(handle.id);
    }

    private previewMove(event: ToolPointerEvent): void {
        const state = this.state;
        if (state.kind !== 'moveSelection' && state.kind !== 'dragHandle') {
            return;
        }
        let delta = { x: event.modelPoint.x - state.start.x, y: event.modelPoint.y - state.start.y };
        if (state.kind === 'dragHandle') {
            delta = this.snapVertexDelta(state.origin, delta, state.vertexId, event.pixelSize);
        }
        state.moved = delta.x !== 0 || delta.y !== 0;
        const command =
            state.kind === 'dragHandle'
                ? new MoveVerticesCommand([state.vertexId], delta, 'Move vertex')
                : new MoveVerticesCommand(state.vertexIds, delta);
        this.context.preview(command);
    }

    /** Delta that puts the vertex onto a nearby snap point if there is one; updates the marker. */
    private snapVertexDelta(origin: Point, delta: Vector2, vertexId: Id, pixelSize: number): Vector2 {
        const target = { x: origin.x + delta.x, y: origin.y + delta.y };
        const snap = this.context.snapEnabled
            ? findSnap(this.context.document, target, SNAP_RADIUS_PX * pixelSize, vertexId)
            : null;
        this.context.setSnapIndicator(snap && { x: snap.x, y: snap.y, derived: snap.kind !== 'vertex' });
        return snap ? { x: snap.x - origin.x, y: snap.y - origin.y } : delta;
    }

    private previewResize(event: ToolPointerEvent): void {
        const state = this.state;
        if (state.kind !== 'dragRadius') {
            return;
        }
        const delta = { x: event.modelPoint.x - state.start.x, y: event.modelPoint.y - state.start.y };
        state.moved = delta.x !== 0 || delta.y !== 0;
        const { radiusX, radiusY } = state.element;
        const next = resizedRadii({ x: radiusX, y: radiusY }, state.side, delta, event.shiftKey, event.pixelSize);
        this.context.preview(new ResizeEllipseCommand(state.element, next, 'Resize ellipse'));
    }

    /** Nearest selection handle within the hit radius, or null. */
    private handleAt(event: ToolPointerEvent): Handle | null {
        const radius = HANDLE_HIT_PX * event.pixelSize;
        let best: Handle | null = null;
        let bestDistance = radius;
        for (const handle of this.context.handles()) {
            const distance = Math.hypot(handle.x - event.modelPoint.x, handle.y - event.modelPoint.y);
            if (distance <= bestDistance) {
                best = handle;
                bestDistance = distance;
            }
        }
        return best;
    }
}

function resizeCursor(side: RadiusSide): string {
    return side === 'left' || side === 'right' ? 'ew-resize' : 'ns-resize';
}

/**
 * Radii after dragging the handle on `side` by `delta`. Only the movement along that side's
 * axis counts, and the centre stays fixed, so both opposite sides move. `uniform` scales the
 * other radius by the same factor. Radii never drop below `minRadius`.
 */
export function resizedRadii(
    current: Vector2,
    side: RadiusSide,
    delta: Vector2,
    uniform: boolean,
    minRadius: number,
): Vector2 {
    const horizontal = side === 'left' || side === 'right';
    const outward = side === 'right' || side === 'top' ? 1 : -1;
    const before = horizontal ? current.x : current.y;
    const after = Math.max(Math.abs(before + outward * (horizontal ? delta.x : delta.y)), minRadius);
    if (uniform) {
        const factor = after / before;
        return { x: Math.max(current.x * factor, minRadius), y: Math.max(current.y * factor, minRadius) };
    }
    return horizontal ? { x: after, y: current.y } : { x: current.x, y: after };
}
