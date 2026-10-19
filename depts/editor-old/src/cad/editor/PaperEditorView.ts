import type { CadDocument } from '../model/CadDocument';
import type { Id, Point } from '../model/Point';
import type { PaperRenderer } from '../renderer/PaperRenderer';
import type { EditorView, OverlayState } from './EditorView';
import { SelectionOverlay } from './overlays/SelectionOverlay';

/** Edit mode view: the shared renderer plus editor overlays on top. */
export class PaperEditorView implements EditorView {
    private readonly renderer: PaperRenderer;
    private readonly selectionOverlay: SelectionOverlay;
    private lastSelection: OverlayState | null = null;

    constructor(renderer: PaperRenderer) {
        this.renderer = renderer;
        this.selectionOverlay = new SelectionOverlay(renderer);
    }

    setDocument(doc: CadDocument): void {
        this.renderer.setDocument(doc);
    }

    updateElements(doc: CadDocument, ids: Iterable<Id>): void {
        this.renderer.updateElements(doc, ids);
    }

    hitTest(viewPoint: Point, tolerancePx: number): Id | null {
        return this.renderer.hitTest(viewPoint, tolerancePx);
    }

    renderSelection(state: OverlayState): void {
        this.lastSelection = state;
        this.selectionOverlay.render(state);
    }

    /** Redraws overlays after a viewport change, so screen-sized handles keep their size. */
    refresh(): void {
        if (this.lastSelection) {
            this.selectionOverlay.render(this.lastSelection);
        }
    }
}
