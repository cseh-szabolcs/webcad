import type { CadDocument } from '../../model/CadDocument';
import type { PolylineElement } from '../../model/CadElement';
import type { Id, Point } from '../../model/Point';
import type { EditorCommand } from '../commandNames';
import type { DocumentChange, DocumentCommand } from './DocumentCommand';

/**
 * A polyline drawn by PLINIE (AutoCAD PLINE), or by another command such as RECHTECK (`label`):
 * one element through `points` (at least two), with a vertex of its own per point, open or closed
 * (the closing segment back to the first point is implied, its vertex not repeated). It has no
 * layer, group or style yet. The ids are fixed on construction, so redo repeats them.
 */
export class AddPolylineCommand implements DocumentCommand {
    readonly label: EditorCommand;
    readonly polylineId: Id;
    readonly points: readonly Point[];
    readonly closed: boolean;
    private readonly vertexIds: readonly Id[];

    constructor(
        points: readonly Point[],
        closed: boolean,
        label: EditorCommand = 'PLINE',
        newId: () => Id = () => crypto.randomUUID(),
    ) {
        this.label = label;
        this.points = points;
        this.closed = closed;
        this.vertexIds = points.map(() => newId());
        this.polylineId = newId();
    }

    execute(doc: CadDocument): DocumentChange {
        const polyline: PolylineElement = {
            id: this.polylineId,
            type: 'polyline',
            layerId: null,
            groupId: null,
            styleId: null,
            vertexIds: [...this.vertexIds],
            closed: this.closed,
        };
        return {
            document: {
                ...doc,
                vertices: [...doc.vertices, ...this.points.map(({ x, y }, i) => ({ id: this.vertexIds[i], x, y }))],
                elements: [...doc.elements, polyline],
            },
            changedElementIds: [this.polylineId],
        };
    }

    undo(doc: CadDocument): DocumentChange {
        const vertexIds = new Set(this.vertexIds);
        return {
            document: {
                ...doc,
                vertices: doc.vertices.filter((vertex) => !vertexIds.has(vertex.id)),
                elements: doc.elements.filter((element) => element.id !== this.polylineId),
            },
            changedElementIds: [this.polylineId],
        };
    }
}
