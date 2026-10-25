import type { CadDocument } from '../../model/CadDocument';
import type { LineElement } from '../../model/CadElement';
import type { Id, Point } from '../../model/Point';
import type { DocumentChange, DocumentCommand } from './DocumentCommand';

/**
 * A segment drawn by LINIE (AutoCAD LINE): a new line from `start` to `end` with two vertices of
 * its own, so it shares none with its neighbours, like AutoCAD's separate line objects. It has
 * no layer, group or style yet. The ids are fixed on construction, so redo repeats them.
 */
export class AddLineCommand implements DocumentCommand {
    readonly label = 'LINE';
    readonly lineId: Id;
    readonly start: Point;
    readonly end: Point;
    private readonly startVertexId: Id;
    private readonly endVertexId: Id;

    constructor(start: Point, end: Point, newId: () => Id = () => crypto.randomUUID()) {
        this.start = start;
        this.end = end;
        this.startVertexId = newId();
        this.endVertexId = newId();
        this.lineId = newId();
    }

    execute(doc: CadDocument): DocumentChange {
        const line: LineElement = {
            id: this.lineId,
            type: 'line',
            layerId: null,
            groupId: null,
            styleId: null,
            startVertexId: this.startVertexId,
            endVertexId: this.endVertexId,
        };
        return {
            document: {
                ...doc,
                vertices: [
                    ...doc.vertices,
                    { id: this.startVertexId, x: this.start.x, y: this.start.y },
                    { id: this.endVertexId, x: this.end.x, y: this.end.y },
                ],
                elements: [...doc.elements, line],
            },
            changedElementIds: [this.lineId],
        };
    }

    undo(doc: CadDocument): DocumentChange {
        const vertexIds = new Set([this.startVertexId, this.endVertexId]);
        return {
            document: {
                ...doc,
                vertices: doc.vertices.filter((vertex) => !vertexIds.has(vertex.id)),
                elements: doc.elements.filter((element) => element.id !== this.lineId),
            },
            changedElementIds: [this.lineId],
        };
    }
}
