import type { Id, Vector2 } from './Point';

export interface BaseElement {
    id: Id;
    layerId: Id | null;
    groupId: Id | null;
    styleId: Id | null;
}

export interface LineElement extends BaseElement {
    type: 'line';
    startVertexId: Id;
    endVertexId: Id;
}

export interface CircleElement extends BaseElement {
    type: 'circle';
    centerVertexId: Id;
    radius: number;
}

/** Control vectors are relative to their end vertex, so they move with it. */
export interface CubicBezierElement extends BaseElement {
    type: 'bezier';
    startVertexId: Id;
    endVertexId: Id;
    startControl: Vector2;
    endControl: Vector2;
}

export interface PolylineElement extends BaseElement {
    type: 'polyline';
    vertexIds: Id[];
    closed: boolean;
}

export type CadElement =
    | LineElement
    | CircleElement
    | CubicBezierElement
    | PolylineElement;

export type CadElementType = CadElement['type'];

/** Ids of all vertices an element references. */
export function vertexRefs(element: CadElement): Id[] {
    switch (element.type) {
        case 'line':
        case 'bezier':
            return [element.startVertexId, element.endVertexId];
        case 'circle':
            return [element.centerVertexId];
        case 'polyline':
            return element.vertexIds;
    }
}
