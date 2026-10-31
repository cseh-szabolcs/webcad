import type { ApiSchema } from 'app/api/types';
import type { Id } from './Point';

export type LineElement = ApiSchema['LineElement'];
export type EllipseElement = ApiSchema['EllipseElement'];
export type CircleElement = ApiSchema['CircleElement'];
export type ArcElement = ApiSchema['ArcElement'];
export type CubicBezierElement = ApiSchema['BezierElement'];
export type PolylineElement = ApiSchema['PolylineElement'];

export type CadElement = ApiSchema['Element'];

/** The properties every element type has. */
export type BaseElement = Pick<CadElement, 'id' | 'name' | 'layerId' | 'groupId' | 'styleId'>;

export type CadElementType = CadElement['type'];

/** Ids of all vertices an element references. */
export function vertexRefs(element: CadElement): Id[] {
    switch (element.type) {
        case 'line':
        case 'bezier':
            return [element.startVertexId, element.endVertexId];
        case 'ellipse':
        case 'circle':
            return [element.centerVertexId];
        case 'arc':
            return [element.centerVertexId, element.startVertexId, element.endVertexId];
        case 'polyline':
            return element.vertexIds;
    }
}

/** The element with its vertex references replaced where `replace` maps them; others kept. */
export function withVertexRefs(element: CadElement, replace: ReadonlyMap<Id, Id>): CadElement {
    const r = (id: Id) => replace.get(id) ?? id;
    switch (element.type) {
        case 'line':
        case 'bezier':
            return { ...element, startVertexId: r(element.startVertexId), endVertexId: r(element.endVertexId) };
        case 'ellipse':
        case 'circle':
            return { ...element, centerVertexId: r(element.centerVertexId) };
        case 'arc':
            return {
                ...element,
                centerVertexId: r(element.centerVertexId),
                startVertexId: r(element.startVertexId),
                endVertexId: r(element.endVertexId),
            };
        case 'polyline':
            return { ...element, vertexIds: element.vertexIds.map(r) };
    }
}
