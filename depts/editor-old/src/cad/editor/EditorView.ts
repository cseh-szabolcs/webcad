import type { CadDocument } from '../model/CadDocument';
import type { Id, Point } from '../model/Point';
import type { Handle } from './selectionHandles';

/** Snap marker position; `derived` points (midpoints, quadrants) are not stored vertices. */
export interface SnapMarker extends Point {
    derived: boolean;
}

/** Everything the edit-mode overlay draws on top of the document. */
export interface OverlayState {
    selected: ReadonlySet<Id>;
    hovered: ReadonlySet<Id>;
    handles: Handle[];
    /** Id of the handle hovered or being dragged. */
    activeHandle: string | null;
    /** Where a dragged point currently snaps to, shown as a marker. */
    snap: SnapMarker | null;
}

/** What the editor core needs from the rendering side. Implemented by PaperEditorView. */
export interface EditorView {
    setDocument(doc: CadDocument): void;
    updateElements(doc: CadDocument, ids: Iterable<Id>): void;
    /** Topmost hittable element under a view point, within `tolerancePx` screen pixels. */
    hitTest(viewPoint: Point, tolerancePx: number): Id | null;
    /** Highlights, handles and the snap marker. */
    renderSelection(state: OverlayState): void;
}
