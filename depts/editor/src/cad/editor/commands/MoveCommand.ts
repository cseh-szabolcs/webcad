import type { CadDocument } from '../../model/CadDocument';
import { vertexRefs } from '../../model/CadElement';
import type { CadElement } from '../../model/CadElement';
import { indexDocument, requireVertex, type DocumentIndex } from '../../model/DocumentIndex';
import type { Id, Vector2 } from '../../model/Point';
import type { DocumentChange, DocumentCommand } from './DocumentCommand';
import { applyElementEdits, revertElementEdits, type AppliedEdits, type ElementEdit } from './elementEdits';

/**
 * SCHIEBEN (AutoCAD MOVE): moves the elements by `delta` by moving each of their vertices
 * once, however many of them share it. Like AutoCAD, elements that are not moved never
 * change: where one of them shares a moved vertex, it is detached onto a copy of the vertex
 * at the old position (one copy per vertex, so those neighbours stay connected to each
 * other). The moved elements keep the original vertex ids (see applyElementEdits).
 */
export class MoveCommand implements DocumentCommand {
    readonly label = 'MOVE';
    private readonly elementIds: ReadonlySet<Id>;
    private readonly delta: Vector2;
    private readonly newId: () => Id;
    /** Ids of the vertex copies; fixed on the first run, so redo repeats them. */
    private readonly copies = new Map<string, Id>();
    private applied: AppliedEdits | null = null;

    constructor(elementIds: Iterable<Id>, delta: Vector2, newId: () => Id = () => crypto.randomUUID()) {
        this.elementIds = new Set(elementIds);
        this.delta = delta;
        this.newId = newId;
    }

    execute(doc: CadDocument): DocumentChange {
        const index = indexDocument(doc);
        const edits = doc.elements
            .filter((element) => this.elementIds.has(element.id))
            .map((element) => translateElement(element, index, this.delta));
        const { change, applied } = applyElementEdits(doc, edits, this.copies, this.newId);
        this.applied = applied;
        return change;
    }

    undo(doc: CadDocument): DocumentChange {
        return this.applied ? revertElementEdits(doc, this.applied) : { document: doc, changedElementIds: [] };
    }
}

/** The element with all its vertices moved by `delta`. */
export function translateElement(element: CadElement, index: DocumentIndex, delta: Vector2): ElementEdit {
    const moved = vertexRefs(element).map((id): [Id, Vector2] => {
        const { x, y } = requireVertex(index, id);
        return [id, { x: x + delta.x, y: y + delta.y }];
    });
    return { element, vertices: new Map(moved) };
}
