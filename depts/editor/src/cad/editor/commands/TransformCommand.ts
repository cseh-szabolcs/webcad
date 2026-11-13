import { transformAngle, transformPoint, transformVector, type Similarity } from '../../geometry/similarity';
import type { CadDocument } from '../../model/CadDocument';
import { vertexRefs, type CadElement } from '../../model/CadElement';
import { indexDocument, requireVertex, type DocumentIndex } from '../../model/DocumentIndex';
import type { Id } from '../../model/Point';
import type { CommandLabel } from '../commandNames';
import type { DocumentChange, DocumentCommand } from './DocumentCommand';
import { applyElementEdits, revertElementEdits, type AppliedEdits, type ElementEdit } from './elementEdits';

/**
 * Rotates, scales or mirrors the elements (see Similarity), named by `label`, e.g. a grip
 * mode. Like MoveCommand, elements that are not transformed never change: where one shares a
 * transformed vertex, it keeps a copy at the old position (see applyElementEdits).
 */
export class TransformCommand implements DocumentCommand {
    readonly label: CommandLabel;
    private readonly elementIds: ReadonlySet<Id>;
    private readonly similarity: Similarity;
    private readonly newId: () => Id;
    /** Ids of the vertex copies; fixed on the first run, so redo repeats them. */
    private readonly copies = new Map<string, Id>();
    private applied: AppliedEdits | null = null;

    constructor(
        label: CommandLabel,
        elementIds: Iterable<Id>,
        similarity: Similarity,
        newId: () => Id = () => crypto.randomUUID(),
    ) {
        this.label = label;
        this.elementIds = new Set(elementIds);
        this.similarity = similarity;
        this.newId = newId;
    }

    execute(doc: CadDocument): DocumentChange {
        const index = indexDocument(doc);
        const edits = doc.elements
            .filter((element) => this.elementIds.has(element.id))
            .map((element) => transformElement(element, index, this.similarity));
        const { change, applied } = applyElementEdits(doc, edits, this.copies, this.newId);
        this.applied = applied;
        return change;
    }

    undo(doc: CadDocument): DocumentChange {
        return this.applied ? revertElementEdits(doc, this.applied) : { document: doc, changedElementIds: [] };
    }
}

/** The element under `s`: its vertices, and what else its type stores (radii, rotation, direction, control points). */
export function transformElement(element: CadElement, index: DocumentIndex, s: Similarity): ElementEdit {
    const vertices = new Map(vertexRefs(element).map((id) => [id, transformPoint(s, requireVertex(index, id))]));
    return { element: transformShape(element, s), vertices };
}

function transformShape(element: CadElement, s: Similarity): CadElement {
    switch (element.type) {
        case 'line':
            return element;
        case 'polyline':
            // A reflection turns its arcs the other way
            return s.mirrored ? { ...element, bulges: element.bulges.map((bulge) => -bulge + 0) } : element;
        case 'circle':
            return s.scale === 1 ? element : { ...element, radius: element.radius * s.scale };
        case 'ellipse':
            return {
                ...element,
                radiusX: element.radiusX * s.scale,
                radiusY: element.radiusY * s.scale,
                rotation: transformAngle(s, element.rotation),
            };
        case 'arc':
            return s.mirrored ? { ...element, clockwise: !element.clockwise } : element;
        case 'bezier':
            return {
                ...element,
                startControl: transformVector(s, element.startControl),
                endControl: transformVector(s, element.endControl),
            };
    }
}
