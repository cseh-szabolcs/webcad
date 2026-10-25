import type { EllipseShape } from '../../geometry/ellipse';
import type { CadDocument } from '../../model/CadDocument';
import type { EllipseElement } from '../../model/CadElement';
import type { Id } from '../../model/Point';
import type { DocumentChange, DocumentCommand } from './DocumentCommand';

/**
 * An ellipse drawn by ELLIPSE (AutoCAD ELLIPSE), with a centre vertex of its own and no layer,
 * group or style yet; a rotation of 0 is left out of the element. The ids are fixed on
 * construction, so redo repeats them.
 */
export class AddEllipseCommand implements DocumentCommand {
    readonly label = 'ELLIPSE';
    readonly ellipseId: Id;
    readonly ellipse: EllipseShape;
    private readonly centerVertexId: Id;

    constructor(ellipse: EllipseShape, newId: () => Id = () => crypto.randomUUID()) {
        this.ellipse = ellipse;
        this.centerVertexId = newId();
        this.ellipseId = newId();
    }

    execute(doc: CadDocument): DocumentChange {
        const { center, radiusX, radiusY, rotation } = this.ellipse;
        const element: EllipseElement = {
            id: this.ellipseId,
            type: 'ellipse',
            layerId: null,
            groupId: null,
            styleId: null,
            centerVertexId: this.centerVertexId,
            radiusX,
            radiusY,
            ...(rotation !== 0 && { rotation }),
        };
        return {
            document: {
                ...doc,
                vertices: [...doc.vertices, { id: this.centerVertexId, x: center.x, y: center.y }],
                elements: [...doc.elements, element],
            },
            changedElementIds: [this.ellipseId],
        };
    }

    undo(doc: CadDocument): DocumentChange {
        return {
            document: {
                ...doc,
                vertices: doc.vertices.filter((vertex) => vertex.id !== this.centerVertexId),
                elements: doc.elements.filter((element) => element.id !== this.ellipseId),
            },
            changedElementIds: [this.ellipseId],
        };
    }
}
