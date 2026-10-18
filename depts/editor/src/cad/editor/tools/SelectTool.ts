import type { Id, Point } from '../../model/Point';
import type { EditorKeyEvent } from '../CadEditor';
import { MoveVerticesCommand } from '../commands/MoveVerticesCommand';
import { selectedVertexIds } from '../selectionHandles';
import type { Tool, ToolContext, ToolPointerEvent } from './Tool';

const DRAG_THRESHOLD_PX = 3;
const HANDLE_HIT_PX = 6;

type State =
    | { kind: 'idle' }
    /** Pointer down on an element; becomes a move once it travels past the threshold. */
    | { kind: 'pressed'; id: Id; start: Point; startView: Point; wasSelected: boolean }
    | { kind: 'moveSelection'; start: Point; vertexIds: Id[]; moved: boolean }
    | { kind: 'dragHandle'; start: Point; vertexId: Id; moved: boolean };

/**
 * Click selects, Shift+click toggles, click on empty space clears.
 * Dragging a selected element moves the selection; dragging a handle moves that vertex.
 * Both preview while dragging and commit one command on release.
 */
export class SelectTool implements Tool {
    private readonly context: ToolContext;
    private state: State = { kind: 'idle' };
    private hoverCursor = 'default';

    constructor(context: ToolContext) {
        this.context = context;
    }

    get cursor(): string {
        return this.state.kind === 'moveSelection' || this.state.kind === 'dragHandle' ? 'move' : this.hoverCursor;
    }

    onPointerDown(event: ToolPointerEvent): void {
        if (event.button !== 0) {
            return;
        }
        const { selection } = this.context;

        const handle = this.handleAt(event);
        if (handle !== null) {
            this.context.setActiveHandle(handle);
            this.state = { kind: 'dragHandle', start: event.modelPoint, vertexId: handle, moved: false };
            return;
        }

        const id = this.context.hitTest(event.viewPoint);
        if (id === null) {
            if (!event.shiftKey) {
                selection.clear();
            }
            return;
        }
        if (event.shiftKey) {
            selection.toggle(id);
            return;
        }

        const wasSelected = selection.selected.has(id);
        if (!wasSelected) {
            selection.select([id]);
        }
        this.state = { kind: 'pressed', id, start: event.modelPoint, startView: event.viewPoint, wasSelected };
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
        }
    }

    onPointerUp(): void {
        const state = this.state;
        this.state = { kind: 'idle' };
        switch (state.kind) {
            case 'pressed':
                // Clicking one element of a multi-selection without dragging selects just that one
                if (state.wasSelected && this.context.selection.selected.size > 1) {
                    this.context.selection.select([state.id]);
                }
                return;
            case 'moveSelection':
            case 'dragHandle':
                if (state.moved) {
                    this.context.commitPreview();
                } else {
                    this.context.cancelPreview();
                }
                if (state.kind === 'dragHandle') {
                    this.context.setActiveHandle(null);
                }
                return;
        }
    }

    onPointerLeave(): void {
        if (this.state.kind === 'idle') {
            this.context.selection.setHovered(null);
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
        }
    }

    onDeactivate(): void {
        this.onCancel();
        this.context.selection.setHovered(null);
    }

    private updateHover(event: ToolPointerEvent): void {
        const handle = this.handleAt(event);
        this.context.setActiveHandle(handle);
        const id = handle === null ? this.context.hitTest(event.viewPoint) : null;
        this.context.selection.setHovered(id);
        this.hoverCursor = handle !== null || id !== null ? 'pointer' : 'default';
    }

    private previewMove(event: ToolPointerEvent): void {
        const state = this.state;
        if (state.kind !== 'moveSelection' && state.kind !== 'dragHandle') {
            return;
        }
        const delta = { x: event.modelPoint.x - state.start.x, y: event.modelPoint.y - state.start.y };
        state.moved = delta.x !== 0 || delta.y !== 0;
        const command =
            state.kind === 'dragHandle'
                ? new MoveVerticesCommand([state.vertexId], delta, 'Move vertex')
                : new MoveVerticesCommand(state.vertexIds, delta);
        this.context.preview(command);
    }

    /** Nearest selection handle within the hit radius, or null. */
    private handleAt(event: ToolPointerEvent): Id | null {
        const radius = HANDLE_HIT_PX * event.pixelSize;
        let best: Id | null = null;
        let bestDistance = radius;
        for (const vertex of this.context.handles()) {
            const distance = Math.hypot(vertex.x - event.modelPoint.x, vertex.y - event.modelPoint.y);
            if (distance <= bestDistance) {
                best = vertex.id;
                bestDistance = distance;
            }
        }
        return best;
    }
}
