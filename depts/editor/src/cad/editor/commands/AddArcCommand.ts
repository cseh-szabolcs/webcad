import type { CadDocument } from '../../model/CadDocument';
import type { ArcElement } from '../../model/CadElement';
import type { Id, Point } from '../../model/Point';
import type { DocumentChange, DocumentCommand } from './DocumentCommand';

/**
 * An arc drawn by BOGEN (AutoCAD ARC) around `center` from `start` to `end`, with vertices of
 * its own and no layer, group or style yet. The ids are fixed on construction, so redo repeats them.
 */
export class AddArcCommand implements DocumentCommand {
    readonly label = 'ARC';
    readonly arcId: Id;
    readonly center: Point;
    readonly start: Point;
    readonly end: Point;
    readonly clockwise: boolean;
    private readonly vertexIds: readonly [center: Id, start: Id, end: Id];

    constructor(center: Point, start: Point, end: Point, clockwise: boolean, newId: () => Id = () => crypto.randomUUID()) {
        this.center = center;
        this.start = start;
        this.end = end;
        this.clockwise = clockwise;
        this.vertexIds = [newId(), newId(), newId()];
        this.arcId = newId();
    }

    execute(doc: CadDocument): DocumentChange {
        const [centerVertexId, startVertexId, endVertexId] = this.vertexIds;
        const arc: ArcElement = {
            id: this.arcId,
            type: 'arc',
            name: null,
            layerId: null,
            groupId: null,
            styleId: null,
            centerVertexId,
            startVertexId,
            endVertexId,
            clockwise: this.clockwise,
        };
        return {
            document: {
                ...doc,
                vertices: [
                    ...doc.vertices,
                    { id: centerVertexId, x: this.center.x, y: this.center.y },
                    { id: startVertexId, x: this.start.x, y: this.start.y },
                    { id: endVertexId, x: this.end.x, y: this.end.y },
                ],
                elements: [...doc.elements, arc],
            },
            changedElementIds: [this.arcId],
        };
    }

    undo(doc: CadDocument): DocumentChange {
        return {
            document: {
                ...doc,
                vertices: doc.vertices.filter((vertex) => !this.vertexIds.includes(vertex.id)),
                elements: doc.elements.filter((element) => element.id !== this.arcId),
            },
            changedElementIds: [this.arcId],
        };
    }
}
