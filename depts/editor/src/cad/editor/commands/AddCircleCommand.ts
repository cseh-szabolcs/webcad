import type { CadDocument } from '../../model/CadDocument';
import { BY_LAYER } from '../../model/ElementAppearance';
import type { CircleElement } from '../../model/CadElement';
import type { Id, Point } from '../../model/Point';
import type { DocumentChange, DocumentCommand } from './DocumentCommand';

/**
 * A circle drawn by KREIS (AutoCAD CIRCLE), with a centre vertex of its own, on layer
 * `layerId` and without group or style. The ids are fixed on construction, so redo repeats them.
 */
export class AddCircleCommand implements DocumentCommand {
    readonly label = 'CIRCLE';
    readonly layerId: Id;
    readonly circleId: Id;
    readonly center: Point;
    readonly radius: number;
    private readonly centerVertexId: Id;

    constructor(layerId: Id, center: Point, radius: number, newId: () => Id = () => crypto.randomUUID()) {
        this.layerId = layerId;
        this.center = center;
        this.radius = radius;
        this.centerVertexId = newId();
        this.circleId = newId();
    }

    execute(doc: CadDocument): DocumentChange {
        const circle: CircleElement = {
            id: this.circleId,
            type: 'circle',
            name: null,
            layerId: this.layerId,
            groupId: null,
            styleId: null,
            ...BY_LAYER,
            centerVertexId: this.centerVertexId,
            radius: this.radius,
        };
        return {
            document: {
                ...doc,
                vertices: [...doc.vertices, { id: this.centerVertexId, x: this.center.x, y: this.center.y }],
                elements: [...doc.elements, circle],
            },
            changedElementIds: [this.circleId],
        };
    }

    undo(doc: CadDocument): DocumentChange {
        return {
            document: {
                ...doc,
                vertices: doc.vertices.filter((vertex) => vertex.id !== this.centerVertexId),
                elements: doc.elements.filter((element) => element.id !== this.circleId),
            },
            changedElementIds: [this.circleId],
        };
    }
}
