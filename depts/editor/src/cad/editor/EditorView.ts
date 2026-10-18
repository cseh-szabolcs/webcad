import type { CadDocument } from '../model/CadDocument';
import type { Id, Point } from '../model/Point';
import type { Vertex } from '../model/Vertex';

/** What the editor core needs from the rendering side. Implemented by PaperEditorView. */
export interface EditorView {
    setDocument(doc: CadDocument): void;
    updateElements(doc: CadDocument, ids: Iterable<Id>): void;
    /** Topmost hittable element under a view point, within `tolerancePx` screen pixels. */
    hitTest(viewPoint: Point, tolerancePx: number): Id | null;
    /** Highlights plus vertex handles; `activeHandle` is hovered or being dragged. */
    renderSelection(selected: ReadonlySet<Id>, hovered: Id | null, handles: Vertex[], activeHandle: Id | null): void;
}
