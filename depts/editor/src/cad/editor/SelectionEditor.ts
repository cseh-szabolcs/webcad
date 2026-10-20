import type { CadDocument } from '../model/CadDocument';
import { indexDocument, type DocumentIndex } from '../model/DocumentIndex';
import type { Id, Point } from '../model/Point';
import type { EditorKeyEvent, EditorPointerEvent } from './EditorPointerEvent';
import { buildElementShapes, type ElementShape } from './selection/ElementShapes';
import { selectionGrips } from './selection/grips';
import { pickAt } from './selection/picking';

/** Half size of the pick box in screen pixels. */
export const PICK_TOLERANCE_PX = 5;

/** What the selection overlay and the UI show. Replaced, never mutated. */
export interface SelectionSnapshot {
    /** Element under the cursor that a click would pick, unless it is already selected. */
    hovered: ReadonlySet<Id>;
    /** Pickfirst selection, made while no command runs (noun-verb). */
    selected: ReadonlySet<Id>;
    /** Grips of the pickfirst selection; they have no function yet. */
    grips: readonly Point[];
}

/**
 * Object selection of the editor like AutoCAD, independent of Paper.js and React. With no
 * command active, a click adds the element under the cursor to the pickfirst selection,
 * Shift+click removes it and Esc clears the selection. Never persisted.
 */
export class SelectionEditor {
    private readonly index: DocumentIndex;
    private readonly shapes: ElementShape[];
    private current: SelectionSnapshot = { hovered: new Set(), selected: new Set(), grips: [] };
    private readonly listeners = new Set<() => void>();
    /** Element under the cursor, whether selected or not. */
    private underCursor: Id | null = null;

    constructor(doc: CadDocument) {
        this.index = indexDocument(doc);
        this.shapes = buildElementShapes(doc);
    }

    get snapshot(): SelectionSnapshot {
        return this.current;
    }

    subscribe(listener: () => void): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    pointerDown(event: EditorPointerEvent): void {
        if (event.button !== 0) {
            return;
        }
        const id = this.pick(event);
        if (id === null) {
            return;
        }
        const selected = new Set(this.current.selected);
        if (event.shiftKey) {
            selected.delete(id);
        } else {
            selected.add(id);
        }
        this.update({ selected });
    }

    pointerMove(event: EditorPointerEvent): void {
        this.underCursor = this.pick(event);
        this.update({});
    }

    pointerLeave(): void {
        this.underCursor = null;
        this.update({});
    }

    /** Returns true if the key was handled. */
    keyDown(event: EditorKeyEvent): boolean {
        if (event.key === 'Escape' && this.current.selected.size > 0) {
            this.update({ selected: new Set() });
            return true;
        }
        return false;
    }

    private pick(event: EditorPointerEvent): Id | null {
        return pickAt(this.shapes, event.modelPoint, PICK_TOLERANCE_PX * event.pixelSize);
    }

    /** Applies the change, derives hover and grips, and notifies if anything differs. */
    private update(change: { selected?: ReadonlySet<Id> }): void {
        const selected = change.selected ?? this.current.selected;
        const hovered = new Set(this.underCursor !== null && !selected.has(this.underCursor) ? [this.underCursor] : []);
        const selectionChanged = !sameIds(selected, this.current.selected);
        if (!selectionChanged && sameIds(hovered, this.current.hovered)) {
            return;
        }
        const grips = selectionChanged
            ? selectionGrips(
                  [...selected].map((id) => this.index.elements.get(id)!),
                  this.index,
              )
            : this.current.grips;
        this.current = { hovered, selected: selectionChanged ? selected : this.current.selected, grips };
        this.listeners.forEach((listener) => listener());
    }
}

function sameIds(a: ReadonlySet<Id>, b: ReadonlySet<Id>): boolean {
    return a.size === b.size && [...a].every((id) => b.has(id));
}
